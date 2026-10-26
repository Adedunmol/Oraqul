'use client';

import type { LauncherKind, LaunchPlan } from '@oraqul/schema';
import { DirectionPill } from '@oraqul/ui';

const LAUNCHER: Record<LauncherKind, string> = {
  solo: 'a solo launch',
  small: 'a small team',
  established: 'an established company',
  major: 'a major release',
};

/** The budget band and the one signal a plan is judged on, under its In brief. */
export function PlanFrame({ plan }: { plan: LaunchPlan }) {
  const { band, signal } = plan;
  if (!band && !signal && plan.calls.length === 0) return null;
  const calls = (['okay', 'risky', 'avoid'] as const).map((direction) => ({
    direction,
    count: plan.calls.filter((c) => c.direction === direction).length,
  }));
  const columnCount =
    Number(Boolean(signal)) + Number(plan.calls.length > 0) + Number(Boolean(band));
  return (
    <section
      aria-label="What the plan is sized for"
      className={`grid grid-cols-1 border-y border-line font-sans [&>*+*]:border-t [&>*]:px-4 [&>*]:py-4 min-[680px]:[&>*+*]:border-t-0 min-[680px]:[&>*+*]:border-l min-[680px]:[&>*]:px-5 ${columnCount === 3 ? 'min-[680px]:grid-cols-3' : columnCount === 2 ? 'min-[680px]:grid-cols-2' : ''}`}
    >
      {signal ? (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted">Judged on</span>
          <b className="text-[15px] font-semibold">{signal.primary}</b>
          <span className="text-[13px] text-muted">
            {signal.target
              ? `Target ${signal.target.value.toLocaleString('en-US')} ${signal.target.unit}${signal.target.floor === null ? '' : `, floor ${signal.target.floor.toLocaleString('en-US')}`}. A target, not a forecast.`
              : 'No target set. Give your own number in the chat.'}
          </span>
        </div>
      ) : null}
      {plan.calls.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Calls</span>
          <span className="flex flex-wrap gap-1.5">
            {calls
              .filter((c) => c.count > 0)
              .map((c) => (
                <span key={c.direction} className="inline-flex items-center gap-1.5">
                  <DirectionPill direction={c.direction} />
                  <b className="font-mono text-[13px] tabular-nums">{c.count}</b>
                </span>
              ))}
          </span>
          <span className="text-[13px] text-muted">Dates, territories and partners.</span>
        </div>
      ) : null}
      {band ? (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted">Sized for</span>
          <b className="text-[15px] font-semibold capitalize">
            {band.band === 'mid' ? 'Mid-size' : band.band} budget
          </b>
          <span className="text-[13px] text-muted">
            {band.launcher ? `For ${LAUNCHER[band.launcher]}. ` : ''}
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
