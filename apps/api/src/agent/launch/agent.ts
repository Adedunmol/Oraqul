import type { ToolContext } from '@oraqul/engine';
import { refusalFor } from '@oraqul/packs';
import type { Output, ThreadEvent } from '@oraqul/schema';
import type { z } from 'zod';
import { toMarkdown } from '../../outputs/export.js';
import {
  type AgentRun,
  type CategoryAgent,
  type Handoff,
  type Reply,
  ReplyError,
} from '../category-agents.js';
import type { Planner } from '../types.js';
import { type AuditDeps, type LaunchAuditInputs, runAudit } from './audit.js';
import type { LaunchConfig, LaunchDeps } from './config.js';
import { runFix } from './fix.js';
import { decideFollowUp, type FollowUpReader } from './follow-up.js';
import { runAnswer, runDateCheck, runPartnerBrief, runPlanAnswer } from './follow-ups.js';
import { type LaunchInputs, type PlanRun, runBuild } from './pipeline.js';
import type { QueryPlanCore, QueryPlanner } from './planner.js';
import type { LaunchRead } from './read-core.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { ResultsReader } from './results-read.js';
import { launchStateSchema } from './state.js';
import type { PlanWriter } from './writer.js';

export interface LaunchAgentDeps<
  R extends LaunchRead = LaunchRead,
  P extends QueryPlanCore = QueryPlanCore,
> {
  config: LaunchConfig<R, P>;
  /** Reads the brief and keeps only what the person said. */
  read: LaunchDeps<R, P>['read'];
  /** Shapes the Qloo queries (stage 1). */
  queries: QueryPlanner<R, P>;
  /** Writes the plan and answers from the findings (stage 2). */
  writer: PlanWriter<R>;
  /** Reads a launch's results from the person's words, for an audit or a fix. */
  results: ResultsReader;
  /** Writes an audit's risks and alternatives from the verdicts. */
  report: ReportWriter<R>;
  /** Web research for release timing and the market, or none. */
  research: Researcher<R>;
  followUps: FollowUpReader;
  /** Checks what a plan was built from, when a follow up reruns it. */
  inputsSchema: z.ZodType<LaunchInputs<R>>;
  /** The same for a saved audit. */
  auditInputsSchema: z.ZodType<LaunchAuditInputs<R>>;
  /** A new tool context per run, so the call budget and the cache are the run's (spec §3.5). */
  tools: () => ToolContext;
  /** The saved plan a follow up is about, and what it was built from. */
  plan: (outputId: string) => Promise<{ output: Output; inputs: unknown } | null>;
  /** The planner for an answer: the model planner, or a scripted summary of the plan. */
  planner: (plan: Output) => Planner;
  maxSteps: number;
}

/**
 * A category agent on the shared launch runtime. Before a chat has a plan, a message does the job
 * the project started with: a build, an audit or a fix. After, a message is read as a question, a
 * what-if, a rival date check, a partner brief, an audit or a fix, and code picks the job
 * (agent.md).
 */
export class LaunchAgent<R extends LaunchRead = LaunchRead, P extends QueryPlanCore = QueryPlanCore>
  implements CategoryAgent
{
  constructor(private readonly deps: LaunchAgentDeps<R, P>) {}

  async run(
    handoff: Handoff,
    emit: (event: ThreadEvent) => void,
    resume?: { state: unknown; reply: Reply },
  ): Promise<AgentRun> {
    const tools = this.deps.tools();
    const run = await this.dispatch(handoff, emit, tools, resume);
    return { ...run, qlooCalls: tools.qloo.callsUsed };
  }

  private async dispatch(
    handoff: Handoff,
    emit: (event: ThreadEvent) => void,
    tools: ToolContext,
    resume?: { state: unknown; reply: Reply },
  ): Promise<PlanRun> {
    const build: LaunchDeps<R, P> = {
      config: this.deps.config,
      read: this.deps.read,
      queries: this.deps.queries,
      writer: this.deps.writer,
      research: this.deps.research,
      tools,
      emit,
    };
    const audit: AuditDeps<R, P> = {
      ...build,
      results: this.deps.results,
      report: this.deps.report,
    };
    if (resume) {
      const state = launchStateSchema.parse(resume.state);
      switch (state.job) {
        case 'build':
          return runBuild(handoff, build, { state, reply: resume.reply });
        case 'audit':
          return runAudit(handoff, audit, { state, reply: resume.reply });
        case 'fix':
          return runFix(handoff, audit, { state, reply: resume.reply });
      }
    }
    const saved = handoff.planId ? await this.deps.plan(handoff.planId) : null;
    if (!saved) {
      if (handoff.mode === 'audit') return runAudit(handoff, audit);
      if (handoff.mode === 'fix') return runFix(handoff, audit);
      return runBuild(handoff, build);
    }

    // Refused in code with fixed words, before any model or Qloo call (spec §10).
    const refusal = refusalFor(handoff.message.text);
    if (refusal) {
      emit({ type: 'message', body: refusal, claims: [] });
      return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0 };
    }

    const { output } = saved;
    const parsed = this.deps.inputsSchema.safeParse(saved.inputs);
    const inputs = parsed.success ? parsed.data : null;
    const chat = handoff.recent.slice(0, -1);
    emit({
      type: 'memory.used',
      items: [
        { source: 'plan', label: output.label },
        { source: 'project', label: 'your brief' },
        ...(chat.length
          ? [{ source: 'chat' as const, label: `the last ${chat.length} messages of this chat` }]
          : []),
      ],
    });
    const { reading, tokens } = await this.deps.followUps.read({
      text: handoff.message.text,
      recent: chat,
      title: handoff.title,
    });
    const job = decideFollowUp(reading, {
      text: handoff.message.text,
      recent: chat,
      title: handoff.title,
    });
    const withTokens = (run: PlanRun): PlanRun => ({ ...run, tokens: run.tokens + tokens });

    if (job.job === 'audit' || job.job === 'fix') {
      // A report is fixed from what it was made from. An Oraqul plan is read back as text.
      if (output.report) {
        const from = this.deps.auditInputsSchema.safeParse(saved.inputs);
        if (job.job === 'audit') return withTokens(await runAudit(handoff, audit));
        if (from.success) {
          return withTokens(
            await runFix(handoff, audit, undefined, { from: { inputs: from.data } }),
          );
        }
        return withTokens(await runFix(handoff, audit));
      }
      const planText = toMarkdown(output);
      return withTokens(
        job.job === 'audit'
          ? await runAudit(handoff, audit, undefined, { planText })
          : await runFix(handoff, audit, undefined, { planText }),
      );
    }

    if (job.job === 'answer' && output.plan) {
      return withTokens(
        await runPlanAnswer(
          handoff,
          { tools, emit, config: this.deps.config, writer: this.deps.writer },
          output,
          inputs,
        ),
      );
    }
    if (job.job === 'answer') {
      return withTokens(
        await runAnswer(
          handoff,
          {
            tools,
            emit,
            config: this.deps.config,
            planner: this.deps.planner(output),
            maxSteps: this.deps.maxSteps,
          },
          output,
          inputs,
        ),
      );
    }
    if (!inputs) {
      emit({
        type: 'message',
        body: 'This plan was saved before follow ups could rerun it, so I cannot change or check it. Start a new plan in this chat to use what-ifs, date checks and partner briefs.',
        claims: [],
      });
      return { reason: 'finished', state: null, receipts: [], output: null, tokens };
    }
    switch (job.job) {
      case 'scenario':
        return withTokens(
          await runBuild(handoff, build, undefined, { inputs, change: job.change }),
        );
      case 'date':
        return withTokens(
          await runDateCheck({ tools, emit, config: this.deps.config }, output, inputs, job.rivals),
        );
      case 'partner':
        return withTokens(
          await runPartnerBrief(
            handoff,
            { tools, emit, config: this.deps.config, writer: this.deps.writer },
            output,
            inputs,
            job.partner,
          ),
        );
    }
  }

  replyLabel(state: unknown, reply: Reply): string {
    const pending = launchStateSchema.parse(state).pending;
    if (!pending) throw new ReplyError('No question is waiting');
    if (reply.kind === 'typed') {
      if (!reply.text.trim()) throw new ReplyError('Type an answer');
      return reply.text;
    }
    if (reply.questionId !== pending.id) throw new ReplyError('That is not the question asked');
    if (reply.kind === 'text') return reply.text;
    const picked = pending.options.filter((o) => reply.optionIds.includes(o.id));
    if (picked.length !== reply.optionIds.length || picked.length === 0) {
      throw new ReplyError('That option is not on the card');
    }
    if (pending.card !== 'multi' && picked.length > 1) {
      throw new ReplyError('Pick one option');
    }
    return picked.map((o) => o.label).join(', ');
  }
}
