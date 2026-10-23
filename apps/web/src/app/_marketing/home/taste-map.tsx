import type { Category } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';
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
  { name: 'Grey Tide', kind: 'Series', cat: 'film', angle: 0, ring: 1 },
  { name: 'Nia Okoro', kind: 'Artist', cat: 'music', angle: 45, ring: 0 },
  { name: 'Mexico City', kind: 'Place', angle: 90, ring: 1 },
  { name: 'The Salt Road', kind: 'Book', cat: 'books', angle: 135, ring: 0 },
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

/**
 * Why the verdicts can be trusted: they come from taste data on what real audiences like across
 * film, music, books, podcasts, games, brands and places (Qloo's). Drawn as one title's taste map.
 */
export function TasteMap() {
  return (
    <section aria-labelledby="taste-title" className={`${band} bg-bg overflow-x-clip`}>
      <div className={`${wrap} grid items-center gap-14 min-[1000px]:grid-cols-[1fr_1.1fr]`}>
        <div className="flex flex-col gap-6">
          <h2 id="taste-title" className={h2Class}>
            Built on what real audiences love.
          </h2>
          <p className="max-w-[46ch] text-[18px] leading-[1.6] text-ink/75">
            Oraqul checks every plan against audience taste data: what people like across film and
            TV, music, books, podcasts, games, brands and places. Then it works out the answer with
            a fixed rule, not a guess.
          </p>
          <ul className="flex flex-col gap-4 border-t border-line pt-6">
            {[
              ['Real taste, not a guess', 'Every number comes from the data, never from the AI.'],
              [
                'Across culture, not one shelf',
                'Who your readers listen to, what your fans watch, where they live.',
              ],
              ['Check any claim', 'Each one comes with a receipt: the exact data behind it.'],
            ].map(([title, text]) => (
              <li key={title} className="grid gap-1 min-[600px]:grid-cols-[200px_1fr]">
                <span className="font-medium">{title}</span>
                <span className="text-[15px] text-ink/70">{text}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-muted">Audience taste data from Qloo.</p>
        </div>

        <figure className="flex flex-col gap-3 max-[639px]:px-9">
          <figcaption className="sr-only">
            An example taste map: a series in the centre, linked to the films, artists, books,
            podcasts, games, brands and places its audience also likes.
          </figcaption>
          <Reveal
            className="relative mx-auto aspect-square w-full max-w-[560px]"
            aria-hidden="true"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              className="absolute inset-0 size-full overflow-visible"
            >
              <circle cx="50" cy="50" r="29" fill="none" stroke="var(--line)" strokeWidth="0.25" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--line)" strokeWidth="0.25" />
              {nodes.map((n, i) => {
                const p = pos(n);
                return (
                  <line
                    key={n.name}
                    x1="50"
                    y1="50"
                    x2={p.x}
                    y2={p.y}
                    stroke={n.cat ? `var(--cat-${n.cat})` : 'var(--muted)'}
                    strokeWidth={n.ring ? 0.35 : 0.6}
                    pathLength={1}
                    className="mk-line"
                    style={{ '--i': i } as CSSProperties}
                  />
                );
              })}
            </svg>
            <span className="absolute top-1/2 left-1/2 flex -translate-1/2 flex-col items-center gap-0.5 rounded-2xl bg-primary px-5 py-3 text-center text-primary-ink shadow-md">
              <span className="font-display text-[clamp(16px,2vw,20px)] font-semibold tracking-[-0.02em]">
                Night Ferry
              </span>
              <span className="text-[11px] opacity-80">Your series</span>
            </span>
            {nodes.map((n, i) => {
              const p = pos(n);
              return (
                <span
                  key={n.name}
                  data-cat={n.cat}
                  className="mk-in absolute flex -translate-1/2 flex-col items-center rounded-xl bg-card px-3 py-1.5 text-center whitespace-nowrap"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, '--i': i + 2 } as CSSProperties}
                >
                  <span className="text-[clamp(11.5px,1.3vw,14px)] font-medium">{n.name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    {n.cat ? <Icon name={n.cat} className="size-3 text-cat" /> : null}
                    {n.kind}
                  </span>
                </span>
              );
            })}
          </Reveal>
          <p className="text-center text-[12.5px] text-muted">
            Example taste map. Names are invented.
          </p>
        </figure>
      </div>
    </section>
  );
}
