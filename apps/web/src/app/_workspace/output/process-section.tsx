'use client';

import type { LaunchPlan } from '@oraqul/schema';
import { processOf } from './plan-views';

/**
 * "How this plan was made": the research rounds, the red team's rounds and the lines the check
 * removed, read from the saved plan. It sits at the top of the Evidence tab, so the work behind a
 * plan is one place away from the plan and nothing in it is silent.
 */
export function ProcessSection({ plan }: { plan: LaunchPlan }) {
  const view = processOf(plan);
  if (!view) return null;
  return (
    <section className="rounded-2xl bg-card px-5 py-[18px]">
      <h3 className="font-display text-[15px] font-semibold">How this plan was made</h3>
      <p className="mb-3 text-[13px] text-muted">
        {view.drafts === 1 ? 'One draft' : `${view.drafts} drafts`}, checked line by line against
        what Qloo returned.
      </p>
      {[...view.research, ...view.review].map((round) => (
        <details key={round.title} className="py-1">
          <summary className="cursor-pointer py-1.5 font-semibold">{round.title}</summary>
          <ul className="flex flex-col gap-1 pb-2 pl-4 text-[13px] text-muted">
            {round.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </details>
      ))}
      {view.dropped.length ? (
        <details className="py-1">
          <summary className="cursor-pointer py-1.5 font-semibold">Lines the check removed</summary>
          <ul className="flex flex-col gap-2 pb-2 pl-4 text-[13px] text-muted">
            {view.dropped.map((d) => (
              <li key={`${d.draft}-${d.text}`}>
                Draft {d.draft}: “{d.text}” was removed because {d.why}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
