import type { ToolContext } from '@oraqul/engine';
import type { Output, PaceState } from '@oraqul/schema';
import { LaunchAgent } from '../launch/agent.js';
import type { Analyst } from '../launch/analyse.js';
import type { ResearchPlanner } from '../launch/research-loop.js';
import type { Reviewer } from '../launch/review.js';
import type { Planner } from '../types.js';
import { filmAuditInputsSchema } from './audit.js';
import { filmLaunch } from './config.js';
import type { FollowUpReader } from './follow-up.js';
import { filmInputsSchema, filmRead } from './pipeline.js';
import type { QueryPlan, QueryPlanner } from './planner.js';
import type { FilmRead, FilmReader } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { ResultsReader } from './results-read.js';
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
  /** The team's own figures against a plan's pace, for a rescue. */
  pace?: (outputId: string) => Promise<PaceState | null>;
  /** The planner for an answer: the model planner, or a scripted summary of the plan. */
  planner: (plan: Output) => Planner;
  maxSteps: number;
}

/** The Film agent: the shared launch runtime configured for films and series (agent.md). */
export class FilmAgent extends LaunchAgent<FilmRead, QueryPlan> {
  constructor(deps: FilmAgentDeps) {
    super({
      ...deps,
      config: filmLaunch,
      read: filmRead(deps.reader),
      inputsSchema: filmInputsSchema,
      auditInputsSchema: filmAuditInputsSchema,
    });
  }
}
