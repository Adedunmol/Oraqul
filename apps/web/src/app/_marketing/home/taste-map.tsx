'use client';

import type { Category } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import { type CSSProperties, useState } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

interface Node {
  name: string;
  kind: string;
  cat?: Category;
  /** Angle in degrees, clockwise from the top, and ring: 0 inner, 1 outer. */
  angle: number;
  ring: 0 | 1;
}

// Invented examples. The page says so; nothing here is real data.
const nodes: Node[] = [
  { name: 'Harbor Lights', kind: 'Series', cat: 'film', angle: 0, ring: 1 },
  { name: 'Nia Okoro', kind: 'Artist', cat: 'music', angle: 45, ring: 0 },
  { name: 'Houston', kind: 'Place', angle: 90, ring: 1 },
  { name: 'The Long Quay', kind: 'Book', cat: 'books', angle: 135, ring: 0 },
  { name: 'Night Shift', kind: 'Podcast', cat: 'podcasts', angle: 180, ring: 1 },
  { name: 'London', kind: 'Place', angle: 225, ring: 0 },
  { name: 'Ember Run', kind: 'Game', cat: 'games', angle: 270, ring: 1 },
  { name: 'Atelier Nord', kind: 'Brand', angle: 315, ring: 0 },
];

const pos = (n: Node) => {
  const r = n.ring ? 44 : 29;
  const a = (n.angle * Math.PI) / 180;
  return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) };
};

const colour = (n: Node) => (n.cat ? `var(--cat-${n.cat})` : 'var(--muted)');

const points: [string, string][] = [
  ['Measured taste', 'Every number comes from the data, never from the AI.'],
  [
    'Across culture, not one shelf',
    'Your comparable titles go in. What that audience also loves comes out, across series, music, books, podcasts, games, brands and places.',
  ],
  ['Check any claim', 'Each one comes with a receipt: the exact data behind it.'],
];

/**
 * Why the verdicts can be trusted: they come from taste data on what real audiences like across
 * film, music, books, podcasts, games, brands and places (Qloo's). One title sits at the centre of
 * the map, with what its audience also loves around it. The map is the section: the three points
 * are annotations either side of it, and a name can be hovered, focused or tapped to light up its
 * link.
 */
export function TasteMap() {
  const [active, setActive] = useState<number | null>(null);
  const on = active === null ? null : nodes[active];
  const toggle = (i: number) => setActive((cur) => (cur === i ? null : i));
  return (
    <section aria-labelledby="taste-title" className={`${band} bg-bg relative overflow-x-clip`}>
      <div className={`${wrap} flex flex-col items-center gap-[clamp(32px,5vw,64px)]`}>
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 id="taste-title" className={h2Class}>
            Built on what real audiences love.
          </h2>
          <p className="max-w-[58ch] text-[clamp(16px,1.4vw,18px)] leading-[1.6] text-ink/75">
            Oraqul gives Qloo what surrounds your launch: comparable titles, places and an age band.
            Qloo returns what that audience likes across film and TV, music, books, podcasts, games,
            brands and places. Then code works out the answer with a fixed rule, and the model only
            writes it up.
          </p>
        </div>

        <div className="grid w-full items-center gap-x-[clamp(24px,4vw,56px)] gap-y-10 min-[1000px]:grid-cols-[minmax(0,1fr)_minmax(0,640px)_minmax(0,1fr)]">
          <div className="hidden flex-col gap-14 text-right min-[1000px]:flex">
            <Point point={points[0]} />
            <Point point={points[1]} />
          </div>

          <figure className="flex flex-col gap-3 max-[639px]:px-9">
            <figcaption className="sr-only">
              An example taste map: two comparable titles in the centre, and around them the series,
              artists, books, podcasts, games, brands and places their audience also likes, as Qloo
              ranks them.
            </figcaption>
            <Reveal className="relative mx-auto aspect-square w-full max-w-[640px]">
              <span
                aria-hidden="true"
                className="absolute -inset-[12%] rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                className="absolute inset-0 size-full overflow-visible"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="29"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="0.25"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="0.25"
                />
                {nodes.map((n, i) => {
                  const p = pos(n);
                  const lit = active === i;
                  return (
                    <g
                      key={n.name}
                      className="transition-opacity duration-200 motion-reduce:transition-none"
                      style={{ opacity: active === null || lit ? 1 : 0.22 }}
                    >
                      <line
                        x1="50"
                        y1="50"
                        x2={p.x}
                        y2={p.y}
                        stroke={colour(n)}
                        strokeWidth={lit ? 0.9 : n.ring ? 0.35 : 0.6}
                        pathLength={1}
                        className="mk-line"
                        style={{ '--i': i } as CSSProperties}
                      />
                      <circle
                        r="0.95"
                        fill={colour(n)}
                        className="mk-flow"
                        style={
                          {
                            offsetPath: `path("M50 50 L${p.x} ${p.y}")`,
                            '--delay': `${1400 + i * 430}ms`,
                          } as CSSProperties
                        }
                      />
                    </g>
                  );
                })}
              </svg>
              <span
                aria-hidden="true"
                className="mk-ring absolute top-1/2 left-1/2 h-[16%] w-[26%] -translate-1/2 rounded-2xl border border-primary"
              />
              <span className="absolute top-1/2 left-1/2 flex -translate-1/2 flex-col items-center gap-0.5 rounded-2xl bg-primary px-3 py-2 text-center min-[640px]:px-5 min-[640px]:py-3 text-primary-ink shadow-md">
                <span className="font-display text-[clamp(13px,1.7vw,19px)] leading-[1.15] font-semibold tracking-[-0.02em]">
                  Salt Road
                </span>
                <span className="font-display text-[clamp(13px,1.7vw,19px)] leading-[1.15] font-semibold tracking-[-0.02em]">
                  The Glass Lantern
                </span>
                <span className="pt-0.5 text-[10px] opacity-80 min-[640px]:text-[11px]">
                  Your comparable titles
                </span>
              </span>
              {nodes.map((n, i) => {
                const p = pos(n);
                return (
                  <button
                    key={n.name}
                    type="button"
                    data-cat={n.cat}
                    data-active={active === i ? '' : undefined}
                    aria-pressed={active === i}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => toggle(i)}
                    className="mk-in absolute flex -translate-1/2 flex-col items-center rounded-lg bg-card px-2 py-1 text-center whitespace-nowrap min-[640px]:rounded-xl min-[640px]:px-3 min-[640px]:py-1.5 transition-[transform,box-shadow] duration-200 hover:z-10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[active]:z-10 data-[active]:scale-110 data-[active]:shadow-md motion-reduce:transition-none"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, '--i': i + 2 } as CSSProperties}
                  >
                    <span className="text-[10.5px] font-medium min-[640px]:text-[clamp(11.5px,1.3vw,14px)]">
                      {n.name}
                    </span>
                    <span className="flex items-center gap-1 text-[9.5px] text-muted min-[640px]:text-[11px]">
                      {n.cat ? (
                        <Icon name={n.cat} className="size-2.5 text-cat min-[640px]:size-3" />
                      ) : null}
                      {n.kind}
                    </span>
                  </button>
                );
              })}
            </Reveal>
            <p aria-live="polite" className="min-h-[1.4em] text-center text-[13px] text-muted">
              {on
                ? `${on.name}, ${/^[aeiou]/i.test(on.kind) ? 'an' : 'a'} ${on.kind.toLowerCase()}: ranked by Qloo for the audience of those titles.`
                : 'Example: titles go in, what their audience loves comes out. Names are invented. Hover or tap a name.'}
            </p>
          </figure>

          <div className="hidden flex-col gap-14 min-[1000px]:flex">
            <Point point={points[2]} />
            <p className="text-[13.5px] text-muted">Audience taste data from Qloo.</p>
          </div>

          <div className="grid gap-8 min-[640px]:grid-cols-3 min-[1000px]:hidden">
            {points.map((p) => (
              <Point key={p[0]} point={p} />
            ))}
            <p className="text-[13.5px] text-muted min-[640px]:col-span-3">
              Audience taste data from Qloo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Point({ point }: { point: [string, string] | undefined }) {
  if (!point) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-[clamp(20px,1.8vw,24px)] leading-[1.15] font-medium tracking-[-0.025em]">
        {point[0]}
      </h3>
      <p className="text-[15px] leading-[1.6] text-ink/70">{point[1]}</p>
    </div>
  );
}
