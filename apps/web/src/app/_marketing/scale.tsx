import type { CSSProperties } from 'react';
import { Reveal } from './reveal';

export interface Zone {
  /** Upper end of the zone, in the scale's own units. */
  to: number;
  label: string;
  fill: 'bg-weak-bg' | 'bg-surface2' | 'bg-holds-bg' | 'bg-breaks-bg';
}

/**
 * A threshold rule drawn as a ruler: coloured zones with their labels underneath and, when a value
 * is given, a marker that slides to it as the scale comes on screen. Thresholds come from spec §5.
 */
export function Scale({
  min,
  max,
  zones,
  value,
  format = (v) => v.toFixed(2),
}: {
  min: number;
  max: number;
  zones: Zone[];
  value?: number;
  format?: (v: number) => string;
}) {
  const span = max - min;
  const width = (from: number, to: number) => `${((to - from) / span) * 100}%`;
  const starts = zones.map((_, i) => (i === 0 ? min : (zones[i - 1]?.to ?? min)));
  return (
    <Reveal className="flex flex-col gap-3">
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-6 flex h-4 overflow-hidden rounded-md">
          {zones.map((z, i) => (
            <span
              key={z.label}
              className={`h-full ${z.fill} ${i ? 'border-l-2 border-card' : ''}`}
              style={{ width: width(starts[i] ?? min, z.to) }}
            />
          ))}
        </div>
        {value === undefined ? null : (
          <span
            aria-hidden="true"
            className="mk-slide absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ '--to': `${((value - min) / span) * 100}%` } as CSSProperties}
          >
            <span className="rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-bg tabular-nums">
              {format(value)}
            </span>
            <span className="h-7 w-[2px] bg-ink" />
          </span>
        )}
      </div>
      <div className="flex text-[12.5px] leading-[1.35] text-muted">
        {zones.map((z, i) => (
          <span key={z.label} className="pr-2" style={{ width: width(starts[i] ?? min, z.to) }}>
            {z.label}
          </span>
        ))}
      </div>
    </Reveal>
  );
}

/** Lift: strong at 1.5 and above, usable 1.2 to 1.5, weak below 1.2. spec §5 */
export const liftZones: Zone[] = [
  { to: 1.2, label: 'Weak below 1.2', fill: 'bg-weak-bg' },
  { to: 1.5, label: 'Usable 1.2 to 1.5', fill: 'bg-surface2' },
  { to: 2.2, label: 'Strong from 1.5', fill: 'bg-holds-bg' },
];
