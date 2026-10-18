import { VerdictPill } from '@oraqul/ui';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Reveal } from '../reveal';
import { liftZones, Scale } from '../scale';
import { band, h2Class, wrap } from '../section';

// Example values only. The thresholds are spec §5: strong at 1.5 and above, usable 1.2 to 1.5.
const score = 0.81;
const baseline = 0.5;
const lift = score / baseline;
const min = 0.6;
const max = 2.2;

/**
 * One worked lift: two values Qloo returned, the division, and the rule that makes a verdict.
 * Computed by code, never by the model.
 */
export function Lift() {
  return (
    <section aria-labelledby="lift-title" className={`bg-accent-soft ${band}`}>
      <Reveal className={`${wrap} flex flex-col gap-16`}>
        <div className="grid gap-6 min-[900px]:grid-cols-[1fr_1fr] min-[900px]:items-end">
          <h2 id="lift-title" className={h2Class}>
            The model writes the words. Code does the maths.
          </h2>
          <p className="max-w-[46ch] text-[17px] leading-[1.55] text-muted min-[900px]:justify-self-end">
            Every score comes from values Qloo returned in the same run, by a published rule. Open
            any receipt and you can redo the sum yourself.
          </p>
        </div>

        <div className="flex flex-col gap-10 rounded-2xl bg-card p-[clamp(20px,4vw,48px)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium">
              Is Mexico City a strong city for Night Ferry’s audience?
            </p>
            <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
              Example
            </span>
          </div>

          <div className="grid items-start gap-6 font-display min-[700px]:grid-cols-[auto_auto_auto_auto_auto] min-[700px]:justify-start min-[700px]:gap-x-6">
            {(
              [
                [score.toFixed(2), 'Taste fit of your audience in Mexico City'],
                ['÷', ''],
                [baseline.toFixed(2), 'A neutral audience in Mexico City'],
                ['=', ''],
                [lift.toFixed(2), 'Lift'],
              ] as const
            ).map(([value, note], i) =>
              note ? (
                <div
                  key={note}
                  className="mk-in flex flex-col gap-2"
                  style={{ '--i': i } as CSSProperties}
                >
                  <span
                    className={`text-[clamp(52px,8vw,112px)] leading-[0.9] font-semibold tracking-[-0.05em] tabular-nums ${i === 4 ? 'text-accent' : ''}`}
                  >
                    {value}
                  </span>
                  <span className="max-w-[18ch] font-sans text-[13.5px] text-muted">{note}</span>
                </div>
              ) : (
                <span
                  key={value}
                  aria-hidden="true"
                  className="mk-in pt-[clamp(8px,1.6vw,22px)] text-[clamp(36px,5vw,64px)] leading-none text-muted max-[699px]:hidden"
                  style={{ '--i': i } as CSSProperties}
                >
                  {value}
                </span>
              ),
            )}
          </div>

          <Scale min={min} max={max} zones={liftZones} value={lift} />

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <span className="text-[15px]">
              {lift.toFixed(2)} is strong, so the belief that Mexico City fits
            </span>
            <VerdictPill verdict="holds" />
            <Link
              href="/method"
              className="text-[14.5px] font-medium text-accent hover:underline sm:ml-auto"
            >
              Every rule, in the method
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
