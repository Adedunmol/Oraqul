import type { ToolContext } from '@oraqul/engine';
import type { ThreadEvent } from '@oraqul/schema';
import type { Handoff, Reply } from '../category-agents.js';
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
import type { AuditState, BuildState, FixState } from '../launch/state.js';
import { gamesLaunch } from './config.js';
import type { GamesQueryPlan, QueryPlanner } from './planner.js';
import { checkReading, type GamesRead, type GamesReader, gamesReadSchema } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { PlanWriter } from './writer.js';

/** What a plan was built from, saved on the output so a what-if can rerun it with a change. */
export const gamesInputsSchema = launchInputsSchema(gamesReadSchema);
export type GamesInputs = LaunchInputs<GamesRead>;

/** What a saved audit was made from, so a fix on it starts from the same reading and comps. */
export const gamesAuditInputsSchema = launchAuditInputsSchema(gamesReadSchema);
export type GamesAuditInputs = LaunchAuditInputs<GamesRead>;

export interface GamesDeps {
  reader: GamesReader;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher;
  queries: QueryPlanner;
  writer: PlanWriter;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}

export interface GamesAuditDeps extends GamesDeps {
  results: ResultsReader;
  report: ReportWriter;
}

/** Reads the brief with the Games reader and keeps only what the person said. */
export const gamesRead =
  (reader: GamesReader): LaunchDeps<GamesRead, GamesQueryPlan>['read'] =>
  async (input) => {
    const { reading, tokens } = await reader.read(input);
    return { read: checkReading(reading, input), tokens };
  };

export function launchDeps(deps: GamesDeps): LaunchDeps<GamesRead, GamesQueryPlan> {
  return {
    config: gamesLaunch,
    read: gamesRead(deps.reader),
    research: deps.research,
    queries: deps.queries,
    writer: deps.writer,
    tools: deps.tools,
    emit: deps.emit,
  };
}

export function launchAuditDeps(deps: GamesAuditDeps): LaunchAuditDeps<GamesRead, GamesQueryPlan> {
  return { ...launchDeps(deps), results: deps.results, report: deps.report };
}

/** The Games build (spec §4.3, §6.1): findings first, then the plan, every line checked. */
export function runGamesBuild(
  handoff: Handoff,
  deps: GamesDeps,
  resume?: { state: BuildState; reply: Reply },
  from?: { inputs: GamesInputs; change: Change },
): Promise<PlanRun> {
  return runBuild(handoff, launchDeps(deps), resume, from);
}

/** The Games audit (spec §6.3): the plan's assumptions tested, as a report and not a plan. */
export function runGamesAudit(
  handoff: Handoff,
  deps: GamesAuditDeps,
  resume?: { state: AuditState; reply: Reply },
  opts: { planText?: string } = {},
): Promise<PlanRun> {
  return runAudit(handoff, launchAuditDeps(deps), resume, opts);
}

/** The Games fix (spec §3.2): audit the plan, save the report, then write a better plan from it. */
export function runGamesFix(
  handoff: Handoff,
  deps: GamesAuditDeps,
  resume?: { state: FixState; reply: Reply },
  opts: { from?: { inputs: GamesAuditInputs }; planText?: string } = {},
): Promise<PlanRun> {
  return runFix(handoff, launchAuditDeps(deps), resume, opts);
}
