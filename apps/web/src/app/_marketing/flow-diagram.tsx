import { Logo } from '@oraqul/ui';
import type { CSSProperties } from 'react';

const inYourTeam: [string, boolean][] = [
  ['Night Ferry', true],
  ['Mexico City, London', true],
  ['Ages 25 to 34', true],
  ['Customer emails', false],
  ['Names of people', false],
];

const sent = ['Night Ferry', 'Mexico City', '25 to 34'];

function Lane() {
  return (
    <div
      aria-hidden="true"
      className="relative min-h-40 min-[900px]:min-h-0 min-[900px]:self-stretch"
    >
      <span className="absolute top-0 bottom-0 left-1/2 w-px bg-line min-[900px]:top-1/2 min-[900px]:right-0 min-[900px]:bottom-auto min-[900px]:left-0 min-[900px]:h-px min-[900px]:w-auto" />
      {sent.map((s, i) => (
        <span key={s} className="contents">
          <span
            className="mk-token top-1/2 -translate-y-1/2 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-primary-ink max-[899px]:hidden"
            style={{ '--delay': `${i * 1.6}s` } as CSSProperties}
          >
            {s}
          </span>
          <span
            className="mk-token-y left-1/2 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-primary-ink min-[900px]:hidden"
            style={{ '--delay': `${i * 1.6}s` } as CSSProperties}
          >
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * What leaves the team, as a picture: everything the team brings on the left, Oraqul keeping only
 * public names, places and age bands, and only those travelling on to Qloo.
 */
export function FlowDiagram() {
  return (
    <div className="grid items-center gap-0 min-[900px]:grid-cols-[1fr_0.8fr_1fr_0.8fr_1fr]">
      <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-5">
        <p className="font-display text-[18px] font-semibold tracking-[-0.02em]">Your team</p>
        <ul className="flex flex-col gap-1.5 text-[14px]">
          {inYourTeam.map(([item, goes]) => (
            <li
              key={item}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${goes ? 'bg-card' : 'bg-surface2 text-muted'}`}
            >
              <span className={goes ? '' : 'line-through'}>{item}</span>
              <span className="text-[12px] font-medium">{goes ? 'Public' : 'Stays here'}</span>
            </li>
          ))}
        </ul>
      </div>
      <Lane />
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-ink p-6 text-center text-bg">
        <Logo />
        <p className="text-[13.5px] leading-[1.5] opacity-80">
          Keeps titles, places and age bands. Drops personal columns from uploads and deletes the
          raw file.
        </p>
      </div>
      <Lane />
      <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-5">
        <p className="font-display text-[18px] font-semibold tracking-[-0.02em]">Qloo</p>
        <p className="text-[14px] text-muted">Taste data comes back for public names only.</p>
        <div className="flex flex-wrap gap-1.5">
          {sent.map((s) => (
            <span key={s} className="rounded-md bg-card px-2.5 py-1 text-[13px]">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
