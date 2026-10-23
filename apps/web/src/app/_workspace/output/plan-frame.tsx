'use client';

import type { LaunchPlan } from '@oraqul/schema';

/** The budget band and the one signal a plan is judged on, under its In brief. */
export function PlanFrame({ plan }: { plan: LaunchPlan }) {
  const { band, signal } = plan;
  if (!band && !signal) return null;
  return (
    <section
      aria-label="What the plan is sized for"
      className="flex flex-wrap items-stretch gap-3 font-sans"
    >
      {signal ? (
        <div className="flex min-w-[220px] flex-1 flex-col gap-1 rounded-xl bg-card px-4 py-3.5">
          <span className="text-xs font-semibold text-muted">Judged on</span>
          <b className="font-display text-[17px] tracking-[-0.02em]">{signal.primary}</b>
          <span className="text-[13px] text-muted">
            {signal.target
              ? `Target ${signal.target.value.toLocaleString('en-US')} ${signal.target.unit}${signal.target.floor === null ? '' : `, floor ${signal.target.floor.toLocaleString('en-US')}`}. A target, not a forecast.`
              : 'No target set. Give your own number in the chat.'}
          </span>
        </div>
      ) : null}
      {band ? (
        <div className="flex min-w-[160px] flex-col gap-1 rounded-xl bg-card px-4 py-3.5">
          <span className="text-xs font-semibold text-muted">Sized for</span>
          <b className="font-display text-[17px] capitalize tracking-[-0.02em]">
            {band.band === 'mid' ? 'Mid-size' : band.band} budget
          </b>
          <span className="text-[13px] text-muted">
            {band.source === 'brief'
              ? 'From your brief.'
              : band.source === 'asked'
                ? 'As you said.'
                : 'Assumed. Say another band and the plan is made again.'}
          </span>
        </div>
      ) : null}
    </section>
  );
}
