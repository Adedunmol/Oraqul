'use client';

import type { Verdict } from '@oraqul/schema';
import { VerdictPill } from '@oraqul/ui';
import { type CSSProperties, useId, useMemo, useState } from 'react';
import { Reveal } from '../reveal';
import { fitBand, fitH2, wrap } from '../section';

// One invented read of three cities, drawn the way the product reads a place: the audience for the
// comparable titles, measured against an average city in the same comparison, and the
// neighbourhoods near the strongest cells. Every figure here is made up and the page says so.
interface City {
  id: string;
  name: string;
  verdict: Verdict;
  /** How strong the audience is, as a multiple of an average city in the same comparison. */
  strength: number;
  line: string;
  areas: string[];
  taste: string;
  peaks: { x: number; y: number; r: number; a: number; label?: string }[];
  /** The shape of the city on the grid: a centre and radii. */
  shape: { x: number; y: number; rx: number; ry: number };
}

const COLS = 26;
const ROWS = 16;

const cities: City[] = [
  {
    id: 'lagos',
    name: 'Lagos',
    verdict: 'holds',
    strength: 1.6,
    line: 'The audience is 1.6 times as strong here as in an average city. Open here first.',
    areas: ['Surulere', 'Lekki'],
    taste: 'Screens that rank highest with this audience: Kingsway Screen, Palm Grove Cinema.',
    shape: { x: 13, y: 8, rx: 11.5, ry: 5.2 },
    peaks: [
      { x: 8, y: 9, r: 3.4, a: 1, label: 'Surulere' },
      { x: 18, y: 7, r: 3.0, a: 0.85, label: 'Lekki' },
      { x: 13, y: 8, r: 5, a: 0.4 },
    ],
  },
  {
    id: 'london',
    name: 'London',
    verdict: 'holds',
    strength: 1.3,
    line: 'A little over an average city. Strong enough to plan for, with the lead in the south.',
    areas: ['Croydon', 'Thamesmead'],
    taste: 'Venues that rank highest with this audience: The Annex, Quay Hall.',
    shape: { x: 13, y: 8, rx: 12, ry: 6.2 },
    peaks: [
      { x: 10, y: 11, r: 3.2, a: 0.85, label: 'Croydon' },
      { x: 19, y: 9, r: 3.4, a: 0.7, label: 'Thamesmead' },
      { x: 13, y: 6, r: 4.6, a: 0.3 },
    ],
  },
  {
    id: 'houston',
    name: 'Houston',
    verdict: 'weak',
    strength: 0.9,
    line: 'Below an average city for these comps. Test it small before you spend.',
    areas: ['Alief', 'Sugar Land'],
    taste: 'Community screenings rank highest here, so start there.',
    shape: { x: 13, y: 8, rx: 12.4, ry: 6.6 },
    peaks: [
      { x: 8, y: 9, r: 2.8, a: 0.55, label: 'Alief' },
      { x: 17, y: 11, r: 3.0, a: 0.45, label: 'Sugar Land' },
      { x: 13, y: 6, r: 4.2, a: 0.25 },
    ],
  },
];

/** A fixed, organic scatter between 0 and 1, so a city looks the same on every visit. */
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** How strongly each cell of the grid reads, 0 for outside the city, up to 1 at the strongest. */
function heat(city: City): number[] {
  const out: number[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const { shape } = city;
      const inside = ((x - shape.x) / shape.rx) ** 2 + ((y - shape.y) / shape.ry) ** 2;
      // An uneven edge, so a city reads as a place and not as an oval.
      if (inside > 0.78 + 0.5 * noise(x * 1.7, y * 2.3)) {
        out.push(-1);
        continue;
      }
      let v = 0.07 + 0.05 * (1 - inside);
      for (const p of city.peaks) {
        v += 0.62 * p.a * Math.exp(-(((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * p.r ** 2)));
      }
      out.push(Math.max(0, Math.min(1, v - 0.2 * noise(x, y))));
    }
  }
  return out;
}

// Five steps of one hue, light to dark, so strength is read from depth alone.
const STEPS = [0, 14, 30, 52, 78];
const level = (v: number) => (v < 0.14 ? 0 : v < 0.3 ? 1 : v < 0.5 ? 2 : v < 0.72 ? 3 : 4);

const facts: [string, string][] = [
  [
    'One comparison',
    'Your cities are ranked together in a single call, so their scores can be compared.',
  ],
  [
    'Honest about thin data',
    'Where a place has too little to rank, it says so and lowers its confidence.',
  ],
  [
    'A lead, not a verdict',
    'Neighbourhoods are readings a few kilometres across: leads to confirm on the ground.',
  ],
];

/**
 * Why a place matters: Oraqul reads every city a team names, and the read changes the plan. Drawn
 * as a dossier of audience strength by cell, the shape of Qloo's own heatmap, with the team's
 * cities as tabs. The map is illustrative and every figure is invented.
 */
export function Regions() {
  const base = useId();
  const [active, setActive] = useState(0);
  const city = cities[active] ?? cities[0];
  const grids = useMemo(() => cities.map(heat), []);
  if (!city) return null;
  const grid = grids[active] ?? [];
  const main = city.peaks[0];
  return (
    <section aria-labelledby="regions-title" className={`scheme-dark mk-glow bg-bg ${fitBand}`}>
      <div className={`${wrap} flex flex-col gap-[clamp(20px,3.6svh,48px)]`}>
        <div className="flex flex-col items-start gap-[clamp(10px,2svh,20px)]">
          <h2 id="regions-title" className={fitH2}>
            Every place you name gets its own read.
          </h2>
          <p className="max-w-[72ch] text-[clamp(15px,1.3vw,17px)] leading-[1.55] text-ink/75">
            Name Lagos and Oraqul asks Qloo what the audience for your comparable titles looks like
            there, ranks it against your other cities, and says whether the place fits. Then it goes
            down to the neighbourhoods.
          </p>
        </div>

        <div className="grid gap-4 min-[1000px]:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <Reveal className="relative overflow-hidden rounded-2xl bg-card p-[clamp(12px,1.6vw,20px)] shadow-lg">
            <div
              aria-hidden="true"
              className="relative mx-auto w-full max-w-[760px] min-[1000px]:max-w-[clamp(400px,calc((100svh-560px)*1.625),760px)]"
              style={{ aspectRatio: `${COLS} / ${ROWS}` }}
            >
              <div
                className="absolute inset-0 grid gap-[3px]"
                style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
              >
                {grid.map((v, i) => {
                  const x = i % COLS;
                  const y = Math.floor(i / COLS);
                  const d = main ? Math.hypot(x - main.x, y - main.y) : 0;
                  const k = v < 0 ? -1 : level(v);
                  return (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: the grid is fixed, so a cell's place is its identity
                      key={i}
                      className="mk-cell aspect-square rounded-[3px] transition-[background-color] duration-500 motion-reduce:transition-none"
                      style={
                        {
                          '--d': Math.round(d),
                          backgroundColor:
                            k < 0
                              ? 'transparent'
                              : k === 0
                                ? 'var(--surface2)'
                                : `color-mix(in srgb, var(--accent) ${STEPS[k]}%, var(--surface2))`,
                        } as CSSProperties
                      }
                    />
                  );
                })}
              </div>
              {city.peaks
                .filter((p) => p.label)
                .map((p) => (
                  <span
                    key={`${city.id}-${p.label}`}
                    className="absolute -translate-1/2 whitespace-nowrap"
                    style={{
                      left: `${((p.x + 0.5) / COLS) * 100}%`,
                      top: `${((p.y + 0.5) / ROWS) * 100}%`,
                    }}
                  >
                    <span className="mk-pin flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-medium text-bg shadow-md">
                      <span className="size-1.5 rounded-full bg-accent" />
                      {p.label}
                    </span>
                  </span>
                ))}
            </div>
            <div
              aria-hidden="true"
              className="mx-auto mt-3 flex w-full max-w-[760px] items-center justify-between gap-4 text-[12px] text-muted"
            >
              <span>Example. Invented figures, and the map is illustrative.</span>
              <span className="flex items-center gap-1.5">
                Weaker
                {STEPS.map((s) => (
                  <span
                    key={s}
                    className="size-3 rounded-[3px]"
                    style={{
                      backgroundColor:
                        s === 0
                          ? 'var(--surface2)'
                          : `color-mix(in srgb, var(--accent) ${s}%, var(--surface2))`,
                    }}
                  />
                ))}
                Stronger
              </span>
            </div>
          </Reveal>

          <div className="flex flex-col gap-3">
            <div role="tablist" aria-label="Example cities" className="flex gap-1.5">
              {cities.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  id={`${base}-${c.id}`}
                  aria-selected={active === i}
                  aria-controls={`${base}-panel`}
                  onClick={() => setActive(i)}
                  className={`flex h-10 flex-1 items-center justify-center rounded-lg px-3 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none ${active === i ? 'bg-accent text-primary-ink' : 'bg-card text-ink hover:bg-surface2'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`${base}-panel`}
              aria-labelledby={`${base}-${city.id}`}
              className="flex flex-1 flex-col gap-3 rounded-2xl bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-[clamp(26px,2.6vw,34px)] leading-none font-medium tracking-[-0.03em]">
                  {city.name}
                </h3>
                <VerdictPill verdict={city.verdict} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div
                  className="relative h-1.5 rounded-full bg-surface2"
                  role="img"
                  aria-label={`${city.strength} times an average city`}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${(city.strength / 2) * 100}%` }}
                  />
                  <span className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-ink/50" />
                </div>
                <div className="flex justify-between text-[11.5px] text-muted">
                  <span>Weaker</span>
                  <span>An average city</span>
                  <span>Stronger</span>
                </div>
              </div>
              <p className="text-[15px] leading-[1.55]">{city.line}</p>
              <p className="text-[14.5px] leading-[1.55] text-ink/75">
                <span className="font-medium text-ink">Strongest around</span>{' '}
                {city.areas.join(' and ')}. {city.taste}
              </p>
              <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
                <p className="text-[13px] text-muted">Your cities, ranked together</p>
                <ol className="flex flex-col gap-1.5">
                  {[...cities]
                    .sort((a, b) => b.strength - a.strength)
                    .map((c) => (
                      <li
                        key={c.id}
                        className={`grid grid-cols-[72px_minmax(0,1fr)_34px] items-center gap-3 text-[13.5px] transition-opacity duration-300 motion-reduce:transition-none ${c.id === city.id ? 'opacity-100' : 'opacity-50'}`}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-surface2">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${(c.strength / 2) * 100}%` }}
                          />
                        </span>
                        <span className="text-right tabular-nums text-muted">
                          {c.strength.toFixed(1)}
                        </span>
                      </li>
                    ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <ul className="grid gap-x-10 gap-y-3 border-t border-line pt-[clamp(12px,2svh,20px)] min-[800px]:grid-cols-3">
          {facts.map(([title, text]) => (
            <li key={title} className="text-[14px] leading-[1.5] text-ink/70">
              <span className="font-medium text-ink">{title}.</span> {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
