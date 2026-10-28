import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { budgetBands, categories, type Role } from '@oraqul/schema';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { RunService } from '../agent/run.service.js';
import { capMessage, RunCapsService } from '../agent/run-caps.js';
import { type Database, DB } from '../db/db.module.js';
import { outputs, projects, runs, threads } from '../db/schema.js';
import { OutputsService } from '../outputs/outputs.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WatchService } from '../watch/watch.service.js';
import { outputLine, planSummary, watchSummary } from './summary.js';
import { TokenLimiter } from './token-limiter.js';
import type { Principal } from './tokens.service.js';

/** A problem a tool reports to the client as a plain message, never as a server error. */
export class McpToolError extends Error {}

const WRITERS: Role[] = ['owner', 'editor'];
const ALL: Role[] = ['owner', 'editor', 'viewer'];

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});
const fail = (message: string) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: message }],
});

const id = z.uuid();

const buildInput = z.strictObject({
  text: z
    .string()
    .min(20)
    .max(6000)
    .describe(
      'What is being launched and where, in plain words, such as: Launch plan for "Night Ferry", a Nigerian thriller film for 18 to 34 year olds, opening in Lagos and London on 2027-03-12. Comps: "Salt Road" and "Midnight Harbor".',
    ),
  category: z
    .enum(categories)
    .optional()
    .describe('The category, when the text does not make it plain.'),
  budget_band: z.enum(budgetBands).optional().describe('The budget band, so Oraqul does not ask.'),
  platforms: z
    .array(z.string().min(1).max(40))
    .max(6)
    .optional()
    .describe('The platforms to plan the campaign on, so Oraqul does not ask.'),
});

const reviewInput = z
  .strictObject({
    project_id: id.optional().describe('An existing project: its newest plan is used.'),
    text: z
      .string()
      .min(20)
      .max(40_000)
      .optional()
      .describe('A plan pasted as text, for a new project.'),
  })
  .refine((v) => Boolean(v.project_id) !== Boolean(v.text), {
    message: 'Give either project_id or text, not both and not neither.',
  });

const runInput = z.strictObject({
  run_id: id.describe('The run_id a build, audit or fix returned.'),
});

const planInput = z
  .strictObject({
    output_id: id.optional().describe('A plan, audit or other output.'),
    project_id: id.optional().describe('A project: its current plan is returned.'),
  })
  .refine((v) => Boolean(v.output_id) !== Boolean(v.project_id), {
    message: 'Give either output_id or project_id, not both and not neither.',
  });

/**
 * The hosted MCP server's tools: the plan pipeline and its results, never the raw Qloo tools. Every
 * tool acts as the token's person in the token's team, with the role checks of the web app. A run
 * counts against the same per person cap and the same Qloo budget as one started in the web app.
 * Nothing here can send anything, confirm a send, change a team rule or make or revoke a token.
 */
@Injectable()
export class McpService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(RunService) private readonly runs: RunService,
    @Inject(RunCapsService) private readonly caps: RunCapsService,
    @Inject(OutputsService) private readonly outputs: OutputsService,
    @Inject(WatchService) private readonly watch: WatchService,
    @Inject(TokenLimiter) private readonly limiter: TokenLimiter,
  ) {}

  private allow(p: Principal, roles: Role[]) {
    if (!roles.includes(p.role)) {
      throw new McpToolError('Your role in this team does not allow that. Ask an owner or editor.');
    }
  }

  /** What starting a run needs: a writer, a confirmed email, a run left this month, and room in the hour. */
  private async mayRun(p: Principal) {
    this.allow(p, WRITERS);
    if (!p.emailVerified)
      throw new McpToolError('Confirm your email in the app before starting a run.');
    const over = await this.caps.exceeded(p.userId);
    if (over) throw new McpToolError(capMessage(over));
    if (!this.limiter.take(p.tokenId, 'run')) {
      throw new McpToolError('This token has started too many runs this hour. Try again later.');
    }
  }

  // Every id is looked up inside the token's team, and a missing one and another team's answer the same.
  private async project(p: Principal, projectId: string) {
    const [row] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.teamId, p.teamId),
          ne(projects.status, 'intake'),
        ),
      );
    if (!row) throw new McpToolError('No such project in this team.');
    return row.id;
  }

  private async thread(p: Principal, threadId: string) {
    const [row] = await this.db
      .select({ id: threads.id })
      .from(threads)
      .innerJoin(projects, eq(projects.id, threads.projectId))
      .where(and(eq(threads.id, threadId), eq(projects.teamId, p.teamId)));
    if (!row) throw new McpToolError('No such run in this team.');
    return row.id;
  }

  private async output(p: Principal, outputId: string) {
    const [row] = await this.db
      .select({ id: outputs.id })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(and(eq(outputs.id, outputId), eq(projects.teamId, p.teamId)));
    if (!row) throw new McpToolError('No such output in this team.');
    return row.id;
  }

  private async planOf(p: Principal, input: { output_id?: string; project_id?: string }) {
    if (input.output_id) return this.output(p, input.output_id);
    const projectId = await this.project(p, input.project_id ?? '');
    const all = await this.outputs.forProject(projectId);
    const current = this.outputs.currentPlanId(all);
    if (!current) throw new McpToolError('This project has no plan yet.');
    return current;
  }

  private async latestThread(projectId: string) {
    const [row] = await this.db
      .select({ id: threads.id })
      .from(threads)
      .where(eq(threads.projectId, projectId))
      .orderBy(desc(threads.createdAt))
      .limit(1);
    if (!row) throw new McpToolError('This project has no chat to run in.');
    return row.id;
  }

  private async review(p: Principal, mode: 'audit' | 'fix', input: z.infer<typeof reviewInput>) {
    await this.mayRun(p);
    if (input.project_id) {
      const threadId = await this.latestThread(await this.project(p, input.project_id));
      await this.runs.post(
        threadId,
        {
          kind: 'text',
          text: mode === 'audit' ? 'Check my plan.' : 'Fix this plan.',
          attachments: [],
        },
        { userId: p.userId, via: 'mcp' },
      );
      return { run_id: threadId, project_id: input.project_id, status: 'running' };
    }
    const created = await this.runs.createProject(
      p.teamId,
      p.userId,
      { text: input.text ?? '', mode, attachments: [] },
      'mcp',
    );
    return { run_id: created.threadId, project_id: created.projectId, status: 'running' };
  }

  private async status(p: Principal, runId: string) {
    const threadId = await this.thread(p, runId);
    const detail = await this.projects.threadDetail(threadId);
    const open = [...detail.items]
      .reverse()
      .find((i) => i.role === 'question' && i.answer === null);
    const said = [...detail.items].reverse().find((i) => i.role === 'agent');
    const [run] = await this.db
      .select({ status: runs.status, stopReason: runs.stopReason })
      .from(runs)
      .where(eq(runs.threadId, threadId))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    const status = detail.busy
      ? 'running'
      : open
        ? 'waiting'
        : run?.status === 'error'
          ? 'failed'
          : run?.stopReason === 'budget' || run?.stopReason === 'stopped'
            ? 'stopped'
            : 'finished';
    const card = open?.role === 'question' ? open.question : null;
    return {
      run_id: threadId,
      status,
      stop_reason: run?.stopReason ?? null,
      question: card
        ? {
            prompt: card.prompt,
            options:
              'options' in card ? card.options.map((o) => ({ id: o.id, label: o.label })) : [],
          }
        : null,
      message: said?.role === 'agent' ? said.text : null,
      outputs: detail.projectOutputs.map(outputLine),
    };
  }

  /** A server for one call, acting as the token's person. */
  serverFor(p: Principal): McpServer {
    const server = new McpServer({ name: 'oraqul', version: '1.0.0' });
    const run = (work: () => Promise<unknown>) =>
      work().then(ok, (err: unknown) =>
        fail(
          err instanceof McpToolError
            ? err.message
            : err instanceof HttpException
              ? String(err.message)
              : 'That did not work. Try again.',
        ),
      );

    server.registerTool(
      'oraqul_list_projects',
      {
        description:
          'List the launch projects of this token’s team: id, name, category, status and when each was last updated.',
        inputSchema: z.strictObject({}),
      },
      () =>
        run(async () => {
          this.allow(p, ALL);
          const list = await this.projects.list(p.teamId, undefined, p.userId);
          return {
            projects: list.map((x) => ({
              id: x.id,
              name: x.name,
              category: x.category,
              status: x.status,
              updated_at: x.updatedAt,
            })),
          };
        }),
    );

    server.registerTool(
      'oraqul_build_plan',
      {
        description:
          'Start building a launch plan for a film, series, album, book, podcast, game or live show. It runs for minutes, so this returns a run_id at once: poll oraqul_get_run_status, answer any question with oraqul_answer_question, then read the plan with oraqul_get_plan. It counts against the team member’s monthly runs and the shared Qloo budget. Oraqul never sends anything.',
        inputSchema: buildInput,
      },
      (args) =>
        run(async () => {
          await this.mayRun(p);
          const text = [
            args.text,
            args.budget_band ? `An ${args.budget_band} budget.` : '',
            args.platforms?.length ? `Channels we already use: ${args.platforms.join(', ')}.` : '',
          ]
            .filter(Boolean)
            .join('\n');
          const created = await this.runs.createProject(
            p.teamId,
            p.userId,
            { text, mode: 'build', category: args.category, attachments: [] },
            'mcp',
          );
          return { run_id: created.threadId, project_id: created.projectId, status: 'running' };
        }),
    );

    server.registerTool(
      'oraqul_audit_plan',
      {
        description:
          'Start an audit of a launch plan: each assumption it rests on is tested against Qloo taste data and marked holds, weak, breaks or could not test. Give project_id to audit a project’s newest plan, or text to audit a plan you paste. Returns a run_id at once; poll oraqul_get_run_status.',
        inputSchema: reviewInput,
      },
      (args) => run(() => this.review(p, 'audit', args)),
    );

    server.registerTool(
      'oraqul_fix_plan',
      {
        description:
          'Start a fix: audit a plan and write a better one from the audit, keeping every city and comp the team chose. Give project_id to fix a project’s newest plan, or text for a plan you paste. Returns a run_id at once; poll oraqul_get_run_status.',
        inputSchema: reviewInput,
      },
      (args) => run(() => this.review(p, 'fix', args)),
    );

    server.registerTool(
      'oraqul_answer_question',
      {
        description:
          'Answer the question a run is waiting on (oraqul_get_run_status shows it with its options). Send an option’s label or your own words.',
        inputSchema: z.strictObject({
          run_id: id,
          answer: z.string().min(1).max(2000),
        }),
      },
      (args) =>
        run(async () => {
          this.allow(p, WRITERS);
          const threadId = await this.thread(p, args.run_id);
          await this.runs.post(
            threadId,
            { kind: 'text', text: args.answer, attachments: [] },
            { userId: p.userId, via: 'mcp' },
          );
          return { run_id: threadId, status: 'running' };
        }),
    );

    server.registerTool(
      'oraqul_get_run_status',
      {
        description:
          'The state of a run: running, waiting (with the question and its options), finished, stopped (a budget or a stop) or failed, what Oraqul last said, and the outputs the project has so far.',
        inputSchema: runInput,
      },
      (args) =>
        run(async () => {
          this.allow(p, ALL);
          return this.status(p, args.run_id);
        }),
    );

    server.registerTool(
      'oraqul_get_plan',
      {
        description:
          'Read a finished plan or audit as a summary: the headline, the moves, each section’s lines with the findings and web pages they cite, and the findings’ sentences. It carries no raw Qloo data and no receipts, the same as a share link. Give output_id, or project_id for the project’s current plan.',
        inputSchema: planInput,
      },
      (args) =>
        run(async () => {
          this.allow(p, ALL);
          const outputId = await this.planOf(p, args);
          return planSummary(await this.projects.outputDetail(outputId, p.userId));
        }),
    );

    server.registerTool(
      'oraqul_get_watch_events',
      {
        description:
          'What the launch watch has found for a plan: rival release dates (with the page and the day it was read), campaign dates that slipped, a plan that has grown old, funding deadlines and follow ups, and where the team’s own figures stand against the plan’s pace. Read only: an event can be approved only in the app.',
        inputSchema: planInput,
      },
      (args) =>
        run(async () => {
          this.allow(p, ALL);
          const outputId = await this.planOf(p, args);
          return watchSummary(await this.watch.state(outputId, p.userId));
        }),
    );

    return server;
  }
}
