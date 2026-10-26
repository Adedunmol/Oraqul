import type { Category } from '@oraqul/schema';
import type { CSSProperties } from 'react';

// The six kinds of launch as overlapping discs, the shape Oraqul measures: audiences that meet.
// They rise like a halo behind the product, in the gap under the message box, never behind text.
const discs: { cat: Category; x: number; y: number }[] = [
  { cat: 'film', x: 13, y: 74 },
  { cat: 'music', x: 27, y: 46 },
  { cat: 'books', x: 42, y: 28 },
  { cat: 'podcasts', x: 58, y: 28 },
  { cat: 'games', x: 73, y: 46 },
  { cat: 'shows', x: 87, y: 74 },
];

/**
 * Decoration only. One idea, drawn quietly: translucent category discs that overlap where audiences
 * meet, with a few hairline rings around them, fading out at the edges. It does not move.
 */
export function HeroArt() {
  return (
    <div
      aria-hidden="true"
      className="mk-hero-art pointer-events-none absolute left-1/2 top-0 z-0 aspect-[2.2/1] w-[min(1100px,132%)] -translate-x-1/2 -translate-y-[58%]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 220 100"
        className="absolute inset-0 size-full overflow-visible"
      >
        {[26, 40, 54].map((r) => (
          <circle
            key={r}
            cx="110"
            cy="100"
            r={r * 1.6}
            fill="none"
            stroke="var(--line)"
            strokeWidth="0.35"
          />
        ))}
      </svg>
      {discs.map((d) => (
        <span
          key={d.cat}
          data-cat={d.cat}
          className="mk-hero-disc absolute aspect-square w-[31%] -translate-1/2 rounded-full"
          style={{ left: `${d.x}%`, top: `${d.y}%` } as CSSProperties}
        />
      ))}
    </div>
  );
}
