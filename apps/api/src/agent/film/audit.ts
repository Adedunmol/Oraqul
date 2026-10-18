import type { Handoff, Reply } from '../category-agents.js';
import {
  type AuditDeps as LaunchAuditDeps,
  type LaunchAuditInputs,
  launchAuditInputsSchema,
  runAudit,
} from '../launch/audit.js';
import type { PlanRun } from '../launch/pipeline.js';
import { type FilmDeps, launchDeps } from './pipeline.js';
import type { QueryPlan } from './planner.js';
import { type FilmRead, filmReadSchema } from './read.js';
import type { ReportWriter } from './report-writer.js';
import type { ResultsReader } from './results-read.js';
import type { AuditState } from './state.js';

export { AUDIT_STEPS } from '../launch/audit.js';

export interface AuditDeps extends FilmDeps {
  results: ResultsReader;
  report: ReportWriter;
}

/** What an audit was made from, so a fix on it starts from the same reading and comps. */
export const filmAuditInputsSchema = launchAuditInputsSchema(filmReadSchema);
export type FilmAuditInputs = LaunchAuditInputs<FilmRead>;

export function launchAuditDeps(deps: AuditDeps): LaunchAuditDeps<FilmRead, QueryPlan> {
  return { ...launchDeps(deps), results: deps.results, report: deps.report };
}

/** The Film audit (spec §6.3): the plan's assumptions tested, as a report and not a plan. */
export function runFilmAudit(
  handoff: Handoff,
  deps: AuditDeps,
  resume?: { state: AuditState; reply: Reply },
  opts: { planText?: string } = {},
): Promise<PlanRun> {
  return runAudit(handoff, launchAuditDeps(deps), resume, opts);
}
