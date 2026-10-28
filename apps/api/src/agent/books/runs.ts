import type { ToolContext } from '@oraqul/engine';
import type { ThreadEvent } from '@oraqul/schema';
import type { Handoff, Reply } from '../category-agents.js';
import type { Analyst } from '../launch/analyse.js';
import {
  type AuditDeps as LaunchAuditDeps,
  type LaunchAuditInputs,
  launchAuditInputsSchema,
  runAudit,
} from '../launch/audit.js';
import type { LaunchDeps } from '../launch/config.js';
import { runFix } from '../launch/fix.js';
import type { Change } from '../launch/follow-up.js';
import {
  type LaunchInputs,
  launchInputsSchema,
  type PlanRun,
  runBuild,
} from '../launch/pipeline.js';
import type { ResultsReader } from '../launch/results-read.js';
import type { Reviewer } from '../launch/review.js';
import type { AuditState, BuildState, FixState } from '../launch/state.js';
import { booksLaunch } from './config.js';
import type { BooksQueryPlan, QueryPlanner } from './planner.js';
import { type BooksRead, type BooksReader, booksReadSchema, checkReading } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { PlanWriter } from './writer.js';

/** What a plan was built from, saved on the output so a what-if can rerun it with a change. */
export const booksInputsSchema = launchInputsSchema(booksReadSchema);
export type BooksInputs = LaunchInputs<BooksRead>;

/** What a saved audit was made from, so a fix on it starts from the same reading and comps. */
export const booksAuditInputsSchema = launchAuditInputsSchema(booksReadSchema);
export type BooksAuditInputs = LaunchAuditInputs<BooksRead>;

export interface BooksDeps {
  reader: BooksReader;
  /** Reads who the audience is and chooses comps from the description. Scripted when omitted. */
  analyst?: Analyst;
  /** The red team and the support check. Scripted when omitted. */
  reviewer?: Reviewer;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher;
  queries: QueryPlanner;
  writer: PlanWriter;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}

export interface BooksAuditDeps extends BooksDeps {
  results: ResultsReader;
  report: ReportWriter;
}

/** Reads the brief with the Books reader and keeps only what the person said. */
export const booksRead =
  (reader: BooksReader): LaunchDeps<BooksRead, BooksQueryPlan>['read'] =>
  async (input) => {
    const { reading, tokens } = await reader.read(input);
    return { read: checkReading(reading, input), tokens };
  };

export function launchDeps(deps: BooksDeps): LaunchDeps<BooksRead, BooksQueryPlan> {
  return {
    config: booksLaunch,
    read: booksRead(deps.reader),
    analyst: deps.analyst,
    reviewer: deps.reviewer,
    research: deps.research,
    queries: deps.queries,
    writer: deps.writer,
    tools: deps.tools,
    emit: deps.emit,
  };
}

export function launchAuditDeps(deps: BooksAuditDeps): LaunchAuditDeps<BooksRead, BooksQueryPlan> {
  return { ...launchDeps(deps), results: deps.results, report: deps.report };
}

/** The Books build (spec §4.3, §6.1): findings first, then the plan, every line checked. */
export function runBooksBuild(
  handoff: Handoff,
  deps: BooksDeps,
  resume?: { state: BuildState; reply: Reply },
  from?: { inputs: BooksInputs; change: Change },
): Promise<PlanRun> {
  return runBuild(handoff, launchDeps(deps), resume, from);
}

/** The Books audit (spec §6.3): the plan's assumptions tested, as a report and not a plan. */
export function runBooksAudit(
  handoff: Handoff,
  deps: BooksAuditDeps,
  resume?: { state: AuditState; reply: Reply },
  opts: { planText?: string } = {},
): Promise<PlanRun> {
  return runAudit(handoff, launchAuditDeps(deps), resume, opts);
}

/** The Books fix (spec §3.2): audit the plan, save the report, then write a better plan from it. */
export function runBooksFix(
  handoff: Handoff,
  deps: BooksAuditDeps,
  resume?: { state: FixState; reply: Reply },
  opts: { from?: { inputs: BooksAuditInputs }; planText?: string } = {},
): Promise<PlanRun> {
  return runFix(handoff, launchAuditDeps(deps), resume, opts);
}
