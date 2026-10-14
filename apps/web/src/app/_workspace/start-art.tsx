import type { StartMode } from '@oraqul/schema';
import type { ReactElement } from 'react';

// One small scene per way to start, drawn in tokens only so it follows light and dark. Neutral
// surfaces with the accent for what Oraqul adds: verdict and category colours stay reserved
// (design-system §3). The `art-*` classes in globals.css play the scene while its card is
// hovered or focused, which is the card's hover feedback in place of a shadow.

const sheet = 'fill-surface stroke-line';
const textLine = 'fill-line';

function PlanArt() {
  return (
    <>
      <rect x="44" y="16" width="156" height="102" rx="12" className={sheet} />
      <rect x="58" y="30" width="58" height="7" rx="3.5" className="fill-ink" />
      <rect x="58" y="43" width="88" height="5" rx="2.5" className={textLine} />
      <path d="M60 104h126" className="stroke-line" strokeDasharray="3 4" />
      <path
        d="M60 100c28-2 38-22 62-26s38-22 54-28v58H60z"
        className="art-fade fill-accent-soft stroke-none"
      />
      <path
        d="M60 100c28-2 38-22 62-26s38-22 54-28"
        pathLength={1}
        className="art-draw fill-none stroke-accent"
        strokeWidth="2.5"
      />
      <circle cx="60" cy="100" r="4" className="fill-surface stroke-accent" strokeWidth="2" />
      <circle cx="122" cy="74" r="4" className="fill-surface stroke-accent" strokeWidth="2" />
      <g className="art-rise">
        <path d="M176 46V24" className="stroke-ink" strokeWidth="2" />
        <path d="M176 24h18l-5 6 5 6h-18z" className="art-wave fill-accent stroke-none" />
      </g>
      <g className="art-float">
        <rect x="18" y="80" width="62" height="26" rx="8" className={sheet} />
        <path
          d="M31 86.5a5 5 0 0 1 5 5c0 3.6-5 8-5 8s-5-4.4-5-8a5 5 0 0 1 5-5z"
          className="fill-none stroke-ink"
          strokeWidth="1.7"
        />
        <rect x="42" y="88" width="28" height="4" rx="2" className="fill-ink" />
        <rect x="42" y="96" width="20" height="4" rx="2" className={textLine} />
      </g>
      <g className="art-float art-later">
        <rect x="164" y="64" width="60" height="26" rx="8" className={sheet} />
        <circle cx="177" cy="74" r="3.5" className="fill-none stroke-ink" strokeWidth="1.7" />
        <circle cx="186" cy="74" r="3.5" className="fill-none stroke-ink" strokeWidth="1.7" />
        <path
          d="M171 84c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5"
          className="fill-none stroke-ink"
          strokeWidth="1.7"
        />
        <rect x="196" y="72" width="18" height="4" rx="2" className={textLine} />
      </g>
    </>
  );
}

const ROWS: { y: number; width: number; holds: boolean }[] = [
  { y: 32, width: 66, holds: true },
  { y: 54, width: 52, holds: true },
  { y: 76, width: 72, holds: false },
  { y: 98, width: 46, holds: true },
];

function CheckArt() {
  return (
    <>
      <rect x="46" y="14" width="136" height="106" rx="12" className={sheet} />
      <rect x="40" y="20" width="136" height="106" rx="12" className={sheet} />
      {ROWS.map((row) => (
        <g key={row.y}>
          <rect x="54" y={row.y + 4} width={row.width} height="6" rx="3" className={textLine} />
          <rect
            x="144"
            y={row.y}
            width="16"
            height="16"
            rx="5"
            className={row.holds ? 'fill-accent-soft stroke-none' : 'fill-surface2 stroke-line'}
          />
          {row.holds ? (
            <path
              d={`M148 ${row.y + 8.5}l2.6 2.6 5-5.2`}
              pathLength={1}
              className="art-draw fill-none stroke-accent"
              style={{ animationDelay: `${(row.y - 32) * 6}ms` }}
              strokeWidth="2"
            />
          ) : (
            <path
              d={`M149 ${row.y + 5}l6 6m0-6-6 6`}
              className="fill-none stroke-ink"
              strokeWidth="2"
            />
          )}
        </g>
      ))}
      <g className="art-scan">
        <circle cx="152" cy="84" r="14" className="fill-none stroke-ink" strokeWidth="2.5" />
        <path d="M162 94l12 12" className="stroke-ink" strokeWidth="4.5" />
      </g>
      <g className="art-float art-later">
        <rect x="178" y="26" width="52" height="24" rx="8" className={sheet} />
        <rect x="188" y="35" width="32" height="6" rx="3" className="fill-accent" />
      </g>
    </>
  );
}

function RescueArt() {
  return (
    <>
      <rect x="34" y="14" width="176" height="104" rx="12" className={sheet} />
      {[42, 64, 86].map((y) => (
        <path key={y} d={`M50 ${y}h146`} className="stroke-line" strokeDasharray="3 4" />
      ))}
      {[
        { x: 52, h: 46 },
        { x: 72, h: 36 },
        { x: 92, h: 26 },
        { x: 112, h: 16 },
      ].map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={104 - bar.h}
          width="12"
          height={bar.h}
          rx="3"
          className="fill-surface2 stroke-line"
        />
      ))}
      <path
        d="M58 56l20 10 20 10 20 10"
        className="fill-none stroke-muted"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <path
        d="M118 86c16 4 22-10 32-20s22-24 40-30"
        pathLength={1}
        className="art-draw fill-none stroke-accent"
        strokeWidth="2.5"
      />
      <path
        d="M181 33l9 3-3 9"
        pathLength={1}
        className="art-draw art-later fill-none stroke-accent"
        strokeWidth="2.5"
      />
      <circle cx="118" cy="86" r="5" className="fill-surface stroke-accent" strokeWidth="2.5" />
      <g className="art-float">
        <rect x="12" y="86" width="60" height="30" rx="8" className={sheet} />
        <path d="M22 96h40M22 106h40" className="stroke-line" />
        <rect x="22" y="93" width="14" height="6" rx="2" className="fill-ink" />
        <rect x="40" y="103" width="18" height="6" rx="2" className={textLine} />
      </g>
    </>
  );
}

const ART: Record<StartMode, () => ReactElement> = {
  start: PlanArt,
  audit: CheckArt,
  rescue: RescueArt,
};

/** Decorative: the card's title and text carry the meaning. */
export function StartArt({ mode, className }: { mode: StartMode; className?: string }) {
  const Scene = ART[mode];
  return (
    <svg
      viewBox="0 0 240 132"
      aria-hidden
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <Scene />
    </svg>
  );
}
