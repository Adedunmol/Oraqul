import type { ToolContext } from '@oraqul/engine';
import type { Output } from '@oraqul/schema';
import { LaunchAgent } from '../launch/agent.js';
import type { Analyst } from '../launch/analyse.js';
import type { FollowUpReader } from '../launch/follow-up.js';
import type { ResearchPlanner } from '../launch/research-loop.js';
import type { ResultsReader } from '../launch/results-read.js';
import type { Reviewer } from '../launch/review.js';
import type { Planner } from '../types.js';
import { showsLaunch } from './config.js';
import type { QueryPlanner, ShowsQueryPlan } from './planner.js';
import type { ShowsRead, ShowsReader } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import { showsAuditInputsSchema, showsInputsSchema, showsRead } from './runs.js';
import type { PlanWriter } from './writer.js';

export interface ShowsAgentDeps {
  reader: ShowsReader;
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
  /** Reads what the request needs before anything is searched. */
  analyst?: Analyst;
  /** Judges what the first round of queries covers and picks a second. */
  researchPlanner?: ResearchPlanner;
  /** Compares a draft plan with the request and sends it back. */
  reviewer?: Reviewer;
  /** The planner for a standalone chat. */
  standalone?: Planner;
  followUps: FollowUpReader;
  /** A new tool context per run, so the call budget and the cache are the run's (spec §3.5). */
  tools: () => ToolContext;
  /** The saved plan a follow up is about, and what it was built from. */
  plan: (outputId: string) => Promise<{ output: Output; inputs: unknown } | null>;
  /** The planner for an answer: the model planner, or a scripted summary of the plan. */
  planner: (plan: Output) => Planner;
  maxSteps: number;
}

/** The Shows agent: the shared launch runtime configured for single shows and short runs (agent.md). */
export class ShowsAgent extends LaunchAgent<ShowsRead, ShowsQueryPlan> {
  constructor(deps: ShowsAgentDeps) {
    super({
      ...deps,
      config: showsLaunch,
      read: showsRead(deps.reader),
      inputsSchema: showsInputsSchema,
      auditInputsSchema: showsAuditInputsSchema,
    });
  }
}
