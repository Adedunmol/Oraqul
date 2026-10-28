import type { ToolContext } from '@oraqul/engine';
import { refusalFor } from '@oraqul/packs';
import type { Output, PaceState, ThreadEvent } from '@oraqul/schema';
import type { z } from 'zod';
import { type FundingResearcher, NoFundingResearch } from '../../funding/fund-research.js';
import { toMarkdown } from '../../outputs/export.js';
import { NO_RULES } from '../../team-rules/compile.js';
import {
  type AgentRun,
  type CategoryAgent,
  type Handoff,
  type Reply,
  ReplyError,
} from '../category-agents.js';
import type { Planner } from '../types.js';
import type { Analyst } from './analyse.js';
import { type AuditDeps, type LaunchAuditInputs, runAudit } from './audit.js';
import type { LaunchConfig, LaunchDeps } from './config.js';
import { runCreativeKit } from './creative.js';
import { runFix } from './fix.js';
import { askedJob, decideFollowUp, type FollowUpReader } from './follow-up.js';
import {
  runAnswer,
  runDateCheck,
  runPartnerBrief,
  runPlanAnswer,
  runStandalone,
  StandalonePlanner,
} from './follow-ups.js';
import { runFunding } from './funding.js';
import { withoutOpportunities } from './opportunities.js';
import { type LaunchInputs, type PlanRun, runBuild } from './pipeline.js';
import type { QueryPlanCore, QueryPlanner } from './planner.js';
import type { LaunchRead } from './read-core.js';
import { runRefresh } from './refresh.js';
import type { ReportWriter } from './report-writer.js';
import { runRescue } from './rescue.js';
import type { Researcher } from './research.js';
import type { ResearchPlanner } from './research-loop.js';
import type { ResultsReader } from './results-read.js';
import type { Reviewer } from './review.js';
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
  /** Reads what the request needs before anything is searched. Scripted when omitted. */
  analyst?: Analyst;
  /** Judges what the first round of queries covers and picks a second. */
  researchPlanner?: ResearchPlanner;
  /** Compares a draft plan with the request and sends it back. */
  reviewer?: Reviewer;
  followUps: FollowUpReader;
  /** Checks what a plan was built from, when a follow up reruns it. */
  inputsSchema: z.ZodType<LaunchInputs<R>>;
  /** The same for a saved audit. */
  auditInputsSchema: z.ZodType<LaunchAuditInputs<R>>;
  /** A new tool context per run, so the call budget and the cache are the run's (spec §3.5). */
  tools: () => ToolContext;
  /** The saved plan a follow up is about, and what it was built from. */
  plan: (outputId: string) => Promise<{ output: Output; inputs: unknown } | null>;
  /** The team's own figures read against a plan's pace, for a rescue. Null when there are none to read. */
  pace?: (outputId: string) => Promise<PaceState | null>;
  /** Looks up funds and sponsorship on the web, for the funding job. None when search is not set up. */
  funding?: FundingResearcher;
  /** The planner for an answer: the model planner, or a scripted summary of the plan. */
  planner: (plan: Output) => Planner;
  /** The planner for a standalone chat. Without a model it says it cannot talk freely. */
  standalone?: Planner;
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
      analyst: this.deps.analyst,
      researchPlanner: this.deps.researchPlanner,
      reviewer: this.deps.reviewer,
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
    if (handoff.fresh) {
      const refusal = refusalFor(handoff.message.text);
      if (refusal) {
        emit({ type: 'message', body: refusal, claims: [] });
        return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0 };
      }
      return runStandalone(handoff, {
        tools,
        emit,
        config: this.deps.config,
        planner: this.deps.standalone ?? new StandalonePlanner(),
        maxSteps: this.deps.maxSteps,
      });
    }
    const saved = handoff.planId ? await this.deps.plan(handoff.planId) : null;
    if (!saved) {
      // Plain words win over the project's mode: a person in a build project who attaches a plan
      // and asks to audit it wants the audit, not a build that reads the plan as a brief.
      const job = askedJob(handoff.message.text) ?? handoff.mode;
      if (job === 'audit') return runAudit(handoff, audit);
      if (job === 'fix') return runFix(handoff, audit);
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
      // What the evidence pointed to beyond the brief is not the team's choice, so it is not read back as one.
      const planText = toMarkdown(withoutOpportunities(output));
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
      case 'refresh':
        return withTokens(await runRefresh(handoff, build, output, inputs));
      case 'rescue':
        return withTokens(
          await runRescue(
            { emit, config: this.deps.config },
            output,
            inputs,
            (await this.deps.pace?.(output.id)) ?? null,
            handoff.title,
          ),
        );
      case 'funding':
        return withTokens(
          await runFunding(
            {
              emit,
              config: this.deps.config,
              researcher: this.deps.funding ?? new NoFundingResearch(),
            },
            output,
            inputs,
            handoff.facts ?? { stage: null, nationality: null },
            handoff.rules ?? NO_RULES,
            handoff.title,
          ),
        );
      case 'creative':
        return withTokens(
          await runCreativeKit(
            { emit, config: this.deps.config },
            output,
            inputs,
            handoff.message.text,
            handoff.title,
          ),
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
