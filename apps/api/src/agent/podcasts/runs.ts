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
import { podcastsLaunch } from './config.js';
import type { PodcastsQueryPlan, QueryPlanner } from './planner.js';
import {
  checkReading,
  type PodcastsRead,
  type PodcastsReader,
  podcastsReadSchema,
} from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { Researcher } from './research.js';
import type { PlanWriter } from './writer.js';

/** What a plan was built from, saved on the output so a what-if can rerun it with a change. */
export const podcastsInputsSchema = launchInputsSchema(podcastsReadSchema);
export type PodcastsInputs = LaunchInputs<PodcastsRead>;

/** What a saved audit was made from, so a fix on it starts from the same reading and comps. */
export const podcastsAuditInputsSchema = launchAuditInputsSchema(podcastsReadSchema);
export type PodcastsAuditInputs = LaunchAuditInputs<PodcastsRead>;

export interface PodcastsDeps {
  reader: PodcastsReader;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher;
  queries: QueryPlanner;
  writer: PlanWriter;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}

export interface PodcastsAuditDeps extends PodcastsDeps {
  results: ResultsReader;
  report: ReportWriter;
}

/** Reads the brief with the Podcasts reader and keeps only what the person said. */
export const podcastsRead =
  (reader: PodcastsReader): LaunchDeps<PodcastsRead, PodcastsQueryPlan>['read'] =>
  async (input) => {
    const { reading, tokens } = await reader.read(input);
    return { read: checkReading(reading, input), tokens };
  };

export function launchDeps(deps: PodcastsDeps): LaunchDeps<PodcastsRead, PodcastsQueryPlan> {
  return {
    config: podcastsLaunch,
    read: podcastsRead(deps.reader),
    research: deps.research,
    queries: deps.queries,
    writer: deps.writer,
    tools: deps.tools,
    emit: deps.emit,
  };
}

export function launchAuditDeps(
  deps: PodcastsAuditDeps,
): LaunchAuditDeps<PodcastsRead, PodcastsQueryPlan> {
  return { ...launchDeps(deps), results: deps.results, report: deps.report };
}

/** The Podcasts build (spec §4.3, §6.1): findings first, then the plan, every line checked. */
export function runPodcastsBuild(
  handoff: Handoff,
  deps: PodcastsDeps,
  resume?: { state: BuildState; reply: Reply },
  from?: { inputs: PodcastsInputs; change: Change },
): Promise<PlanRun> {
  return runBuild(handoff, launchDeps(deps), resume, from);
}

/** The Podcasts audit (spec §6.3): the plan's assumptions tested, as a report and not a plan. */
export function runPodcastsAudit(
  handoff: Handoff,
  deps: PodcastsAuditDeps,
  resume?: { state: AuditState; reply: Reply },
  opts: { planText?: string } = {},
): Promise<PlanRun> {
  return runAudit(handoff, launchAuditDeps(deps), resume, opts);
}

/** The Podcasts fix (spec §3.2): audit the plan, save the report, then write a better plan from it. */
export function runPodcastsFix(
  handoff: Handoff,
  deps: PodcastsAuditDeps,
  resume?: { state: FixState; reply: Reply },
  opts: { from?: { inputs: PodcastsAuditInputs }; planText?: string } = {},
): Promise<PlanRun> {
  return runFix(handoff, launchAuditDeps(deps), resume, opts);
}
