import type { ToolContext } from '@oraqul/engine';
import { refusalFor } from '@oraqul/packs';
import type { Output, ThreadEvent } from '@oraqul/schema';
import { toMarkdown } from '../../outputs/export.js';
import {
  type AgentRun,
  type CategoryAgent,
  type Handoff,
  type Reply,
  ReplyError,
} from '../category-agents.js';
import type { Planner } from '../types.js';
import { type AuditDeps, filmAuditInputsSchema, runFilmAudit } from './audit.js';
import { runFilmFix } from './fix.js';
import { decideFollowUp, type FollowUpReader } from './follow-up.js';
import { runAnswer, runDateCheck, runPartnerBrief, runPlanAnswer } from './follow-ups.js';
import { filmInputsSchema, type PlanRun, runFilmBuild } from './pipeline.js';
import type { QueryPlanner } from './planner.js';
import type { FilmReader } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { ResultsReader } from './results-read.js';
import { filmStateSchema } from './state.js';
import type { PlanWriter } from './writer.js';

export interface FilmAgentDeps {
  reader: FilmReader;
  /** Shapes the Qloo queries (stage 1). */
  queries: QueryPlanner;
  /** Writes the plan and answers from the findings (stage 2). */
  writer: PlanWriter;
  /** Reads a launch's results from the person's words, for an audit or a fix. */
  results: ResultsReader;
  /** Writes an audit's risks and alternatives from the verdicts. */
  report: ReportWriter;
  /** Web research for release timing and the market, or none. */
  research: Researcher;
  followUps: FollowUpReader;
  /** A new tool context per run, so the call budget and the cache are the run's (spec §3.5). */
  tools: () => ToolContext;
  /** The saved plan a follow up is about, and what it was built from. */
  plan: (outputId: string) => Promise<{ output: Output; inputs: unknown } | null>;
  /** The planner for an answer: the model planner, or a scripted summary of the plan. */
  planner: (plan: Output) => Planner;
  maxSteps: number;
}

/**
 * The Film agent. Before a chat has a plan, a message does the job the project started with: a
 * build, an audit or a fix. After, a message is read as a question, a what-if, a rival date check,
 * a partner brief, an audit or a fix, and code picks the job (agent.md).
 */
export class FilmAgent implements CategoryAgent {
  constructor(private readonly deps: FilmAgentDeps) {}

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
    const build = {
      reader: this.deps.reader,
      queries: this.deps.queries,
      writer: this.deps.writer,
      research: this.deps.research,
      tools,
      emit,
    };
    const audit: AuditDeps = { ...build, results: this.deps.results, report: this.deps.report };
    if (resume) {
      const state = filmStateSchema.parse(resume.state);
      switch (state.job) {
        case 'build':
          return runFilmBuild(handoff, build, { state, reply: resume.reply });
        case 'audit':
          return runFilmAudit(handoff, audit, { state, reply: resume.reply });
        case 'fix':
          return runFilmFix(handoff, audit, { state, reply: resume.reply });
      }
    }
    const saved = handoff.planId ? await this.deps.plan(handoff.planId) : null;
    if (!saved) {
      if (handoff.mode === 'audit') return runFilmAudit(handoff, audit);
      if (handoff.mode === 'fix') return runFilmFix(handoff, audit);
      return runFilmBuild(handoff, build);
    }

    // Refused in code with fixed words, before any model or Qloo call (spec §10).
    const refusal = refusalFor(handoff.message.text);
    if (refusal) {
      emit({ type: 'message', body: refusal, claims: [] });
      return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0 };
    }

    const { output } = saved;
    const parsed = filmInputsSchema.safeParse(saved.inputs);
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
        const from = filmAuditInputsSchema.safeParse(saved.inputs);
        if (job.job === 'audit') return withTokens(await runFilmAudit(handoff, audit));
        if (from.success) {
          return withTokens(
            await runFilmFix(handoff, audit, undefined, { from: { inputs: from.data } }),
          );
        }
        return withTokens(await runFilmFix(handoff, audit));
      }
      const planText = toMarkdown(output);
      return withTokens(
        job.job === 'audit'
          ? await runFilmAudit(handoff, audit, undefined, { planText })
          : await runFilmFix(handoff, audit, undefined, { planText }),
      );
    }

    if (job.job === 'answer' && output.plan) {
      return withTokens(
        await runPlanAnswer(handoff, { tools, emit, writer: this.deps.writer }, output, inputs),
      );
    }
    if (job.job === 'answer') {
      return withTokens(
        await runAnswer(
          handoff,
          { tools, emit, planner: this.deps.planner(output), maxSteps: this.deps.maxSteps },
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
          await runFilmBuild(handoff, build, undefined, { inputs, change: job.change }),
        );
      case 'date':
        return withTokens(await runDateCheck({ tools, emit }, output, inputs, job.rivals));
      case 'partner':
        return withTokens(
          await runPartnerBrief(
            handoff,
            { tools, emit, writer: this.deps.writer },
            output,
            inputs,
            job.partner,
          ),
        );
    }
  }

  replyLabel(state: unknown, reply: Reply): string {
    const pending = filmStateSchema.parse(state).pending;
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
