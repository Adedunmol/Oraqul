import type { ToolContext } from '@oraqul/engine';
import type { ThreadEvent } from '@oraqul/schema';
import type { Handoff, Reply } from '../category-agents.js';
import type { LaunchDeps } from '../launch/config.js';
import {
  type LaunchInputs,
  launchInputsSchema,
  type PlanRun,
  runBuild,
} from '../launch/pipeline.js';
import { filmLaunch } from './config.js';
import type { Change } from './follow-up.js';
import type { QueryPlan, QueryPlanner } from './planner.js';
import { checkReading, type FilmRead, type FilmReader, filmReadSchema } from './read.js';
import type { Researcher } from './research.js';
import type { BuildState } from './state.js';
import type { PlanWriter } from './writer.js';

export type { Anchor, Anchors, PlanRun } from '../launch/pipeline.js';

/** What a plan was built from, saved on the output so a what-if can rerun it with a change. */
export const filmInputsSchema = launchInputsSchema(filmReadSchema);
export type FilmInputs = LaunchInputs<FilmRead>;

export interface FilmDeps {
  reader: FilmReader;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher;
  queries: QueryPlanner;
  writer: PlanWriter;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}

/** Reads the brief with Film's reader and keeps only what the person said. */
export const filmRead =
  (reader: FilmReader): LaunchDeps<FilmRead, QueryPlan>['read'] =>
  async (input) => {
    const { reading, tokens } = await reader.read(input);
    return { read: checkReading(reading, input), tokens };
  };

export function launchDeps(deps: FilmDeps): LaunchDeps<FilmRead, QueryPlan> {
  return {
    config: filmLaunch,
    read: filmRead(deps.reader),
    research: deps.research,
    queries: deps.queries,
    writer: deps.writer,
    tools: deps.tools,
    emit: deps.emit,
  };
}

/** The Film build (spec §4.1, §6.1): findings first, then the plan, every line checked. */
export function runFilmBuild(
  handoff: Handoff,
  deps: FilmDeps,
  resume?: { state: BuildState; reply: Reply },
  /** A what-if: start from a saved plan's inputs with a change, instead of reading the brief. */
  from?: { inputs: FilmInputs; change: Change },
): Promise<PlanRun> {
  return runBuild(handoff, launchDeps(deps), resume, from);
}
