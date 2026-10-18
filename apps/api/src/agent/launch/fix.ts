import type { AuditReport } from '@oraqul/schema';
import { type Handoff, type NewOutput, PLAN_CHARS, type Reply } from '../category-agents.js';
import { normalise } from '../router/decide.js';
import {
  AUDIT_STEPS,
  type AuditDeps,
  type Audited,
  auditStages,
  type LaunchAuditInputs,
  reviewPlan,
} from './audit.js';
import { askQloo, briefText, type PlanRun, type RunCtx, runCtx, writePlan } from './pipeline.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';
import { bandsOfLabel } from './results.js';
import { checkResults } from './results-read.js';
import type { FixState } from './state.js';

// The plan itself adds two steps to the audit: writing it and checking every line.
const FIX_STEPS = AUDIT_STEPS + 2;

const same = (a: string, b: string) => normalise(a) === normalise(b);

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = normalise(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The brief a fixed plan is written for. The team's choices stay: before launch the cities are
 * ordered by where the audience is strongest, and after it by where the launch did best, with any
 * city the results add. Nothing is dropped (spec §5.2).
 */
export function fixRead<R extends LaunchRead>(read: R, report: AuditReport, ranked: string[]): R {
  const results = report.results;
  const places = results
    ? unique([...results.rows.map((r) => r.place), ...read.places])
    : unique([...ranked.filter((p) => read.places.some((q) => same(q, p))), ...read.places]);
  const top = results?.ages?.slice().sort((a, b) => b.actualShare - a.actualShare)[0];
  const bands = top ? bandsOfLabel(top.band) : [];
  return {
    ...read,
    places,
    ages: bands.length ? bands : read.ages,
    scope: 'full',
    ask: null,
  };
}

/** What the writer is told to fix, from the audit's own verdicts and the person's results. */
export function fixNotes(report: AuditReport): string {
  const fixes = report.items.flatMap((i) =>
    (i.verdict === 'weak' || i.verdict === 'breaks') && i.fix
      ? [`- ${i.claim}: ${i.fix.text}`]
      : [],
  );
  const results = report.results
    ? [
        `Results (${report.results.measure}${report.results.asOf ? `, ${report.results.asOf}` : ''}), in the order the cities finished:`,
        ...report.results.rows.map(
          (r) =>
            `- ${r.place}: ${r.actualShare}% of the total, planned place ${r.plannedRank ?? 'none'}`,
        ),
      ]
    : [];
  return [
    fixes.length ? ['Fixes to make, from the audit of your plan:', ...fixes].join('\n') : '',
    results.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The fix (spec §3.2): audit the plan, save the report, then write a better plan from it. A fix on
 * a saved report starts from what that report was made from, so only the plan is new.
 */
export async function runFix<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: AuditDeps<R, P>,
  resume?: { state: FixState; reply: Reply },
  opts: {
    /** A saved report to fix: its reading and comps stand, and only the plan is new. */
    from?: { inputs: LaunchAuditInputs<R> };
    /** An Oraqul plan, as text, to audit in place of the message and its files. */
    planText?: string;
  } = {},
): Promise<PlanRun> {
  const { from } = opts;
  const ctx = runCtx(deps, FIX_STEPS + (deps.research.enabled ? 1 : 0));
  const audited = await auditFor(handoff, deps, ctx, resume, from, opts.planText);
  if ('stop' in audited) return audited.stop;

  const { report, read, comps, asked, review } = audited;
  const title = handoff.title;
  const fixed = fixRead(
    read,
    report,
    asked.grounded.brief.teamOrder.map((p) => p.place),
  );
  // New cities or ages from the results are asked about too; otherwise the audit's findings stand.
  const newPlaces = fixed.places.some((p) => !read.places.some((q) => same(q, p)));
  const newAges = fixed.ages.join() !== read.ages.join();
  const planAsked =
    newPlaces || newAges ? await askQloo(deps, ctx, { title, read: fixed, comps }) : asked;

  const earlier: NewOutput[] = from ? [] : [{ ...audited.output, callIds: audited.callIds }];
  return writePlan(deps, ctx, {
    handoff,
    title,
    read: fixed,
    comps,
    asked: planAsked,
    extra: [review.extra, fixNotes(report)].filter(Boolean).join('\n\n'),
    kind: 'fix',
    intro: `Here is the fixed plan for “${title}”.`,
    chars: PLAN_CHARS,
    earlier,
  });
}

async function auditFor<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: AuditDeps<R, P>,
  ctx: RunCtx,
  resume?: { state: FixState; reply: Reply },
  from?: { inputs: LaunchAuditInputs<R> },
  planText?: string,
): Promise<{ stop: PlanRun } | Audited<R, P>> {
  if (!from) {
    const review = await reviewPlan(handoff, deps, ctx, 'fix', resume, planText);
    if ('stop' in review) return review;
    return auditStages(handoff, deps, ctx, review);
  }
  // A follow up on a saved report: its reading and comps stand, and results may be new.
  const text = briefText(handoff, PLAN_CHARS);
  const said = await deps.results.read({ text: handoff.message.text });
  ctx.tokens += said.tokens;
  const found = checkResults(said.reading, handoff.message.text);
  return auditStages(
    handoff,
    deps,
    ctx,
    {
      text,
      extra: '',
      read: from.inputs.read,
      launched: from.inputs.phase === 'post' || found.launched,
      results: found.results ?? from.inputs.results,
    },
    {
      comps: {
        resolved: from.inputs.resolved,
        used: from.inputs.used,
        dropped: from.inputs.dropped,
      },
    },
  );
}
