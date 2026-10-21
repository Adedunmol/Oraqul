import type { ToolContext } from '@oraqul/engine';
import type { Output } from '@oraqul/schema';
import { LaunchAgent } from '../launch/agent.js';
import type { FollowUpReader } from '../launch/follow-up.js';
import type { ResultsReader } from '../launch/results-read.js';
import type { Planner } from '../types.js';
import { booksLaunch } from './config.js';
import type { BooksQueryPlan, QueryPlanner } from './planner.js';
import type { BooksRead, BooksReader } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import { booksAuditInputsSchema, booksInputsSchema, booksRead } from './runs.js';
import type { PlanWriter } from './writer.js';

export interface BooksAgentDeps {
  reader: BooksReader;
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

/** The Books agent: the shared launch runtime configured for book launches (agent.md). */
export class BooksAgent extends LaunchAgent<BooksRead, BooksQueryPlan> {
  constructor(deps: BooksAgentDeps) {
    super({
      ...deps,
      config: booksLaunch,
      read: booksRead(deps.reader),
      inputsSchema: booksInputsSchema,
      auditInputsSchema: booksAuditInputsSchema,
    });
  }
}
