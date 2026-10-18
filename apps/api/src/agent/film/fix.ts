import type { Handoff, Reply } from '../category-agents.js';
import { runFix } from '../launch/fix.js';
import type { PlanRun } from '../launch/pipeline.js';
import { type AuditDeps, type FilmAuditInputs, launchAuditDeps } from './audit.js';
import type { FixState } from './state.js';

export { fixNotes, fixRead } from '../launch/fix.js';

/**
 * The Film fix (spec §3.2): audit the plan, save the report, then write a better plan from it. A
 * fix on a saved report starts from what that report was made from, so only the plan is new.
 */
export function runFilmFix(
  handoff: Handoff,
  deps: AuditDeps,
  resume?: { state: FixState; reply: Reply },
  opts: {
    /** A saved report to fix: its reading and comps stand, and only the plan is new. */
    from?: { inputs: FilmAuditInputs };
    /** An Oraqul plan, as text, to audit in place of the message and its files. */
    planText?: string;
  } = {},
): Promise<PlanRun> {
  return runFix(handoff, launchAuditDeps(deps), resume, opts);
}
