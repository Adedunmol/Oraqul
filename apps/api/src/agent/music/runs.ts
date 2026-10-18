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
import { musicLaunch } from './config.js';
import type { MusicQueryPlan, QueryPlanner } from './planner.js';
import { checkReading, type MusicRead, type MusicReader, musicReadSchema } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { PlanWriter } from './writer.js';

/** What a plan was built from, saved on the output so a what-if can rerun it with a change. */
export const musicInputsSchema = launchInputsSchema(musicReadSchema);
export type MusicInputs = LaunchInputs<MusicRead>;

/** What a saved audit was made from, so a fix on it starts from the same reading and comps. */
export const musicAuditInputsSchema = launchAuditInputsSchema(musicReadSchema);
export type MusicAuditInputs = LaunchAuditInputs<MusicRead>;

export interface MusicDeps {
  reader: MusicReader;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher;
  queries: QueryPlanner;
  writer: PlanWriter;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}

export interface MusicAuditDeps extends MusicDeps {
  results: ResultsReader;
  report: ReportWriter;
}

/** Reads the brief with Music's reader and keeps only what the person said. */
export const musicRead =
  (reader: MusicReader): LaunchDeps<MusicRead, MusicQueryPlan>['read'] =>
  async (input) => {
    const { reading, tokens } = await reader.read(input);
    return { read: checkReading(reading, input), tokens };
  };

export function launchDeps(deps: MusicDeps): LaunchDeps<MusicRead, MusicQueryPlan> {
  return {
    config: musicLaunch,
    read: musicRead(deps.reader),
    research: deps.research,
    queries: deps.queries,
    writer: deps.writer,
    tools: deps.tools,
    emit: deps.emit,
  };
}

export function launchAuditDeps(deps: MusicAuditDeps): LaunchAuditDeps<MusicRead, MusicQueryPlan> {
  return { ...launchDeps(deps), results: deps.results, report: deps.report };
}

/** The Music build (spec §4.2, §6.1): findings first, then the plan, every line checked. */
export function runMusicBuild(
  handoff: Handoff,
  deps: MusicDeps,
  resume?: { state: BuildState; reply: Reply },
  from?: { inputs: MusicInputs; change: Change },
): Promise<PlanRun> {
  return runBuild(handoff, launchDeps(deps), resume, from);
}

/** The Music audit (spec §6.3): the plan's assumptions tested, as a report and not a plan. */
export function runMusicAudit(
  handoff: Handoff,
  deps: MusicAuditDeps,
  resume?: { state: AuditState; reply: Reply },
  opts: { planText?: string } = {},
): Promise<PlanRun> {
  return runAudit(handoff, launchAuditDeps(deps), resume, opts);
}

/** The Music fix (spec §3.2): audit the plan, save the report, then write a better plan from it. */
export function runMusicFix(
  handoff: Handoff,
  deps: MusicAuditDeps,
  resume?: { state: FixState; reply: Reply },
  opts: { from?: { inputs: MusicAuditInputs }; planText?: string } = {},
): Promise<PlanRun> {
  return runFix(handoff, launchAuditDeps(deps), resume, opts);
}
