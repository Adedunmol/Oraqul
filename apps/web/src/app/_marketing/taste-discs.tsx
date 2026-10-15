import type { Category } from '@oraqul/schema';
import type { CSSProperties } from 'react';

interface Disc {
  cat: Category;
  /** Position and size as percentages of the parent, so the art scales with it. */
  x: number;
  y: number;
  size: number;
  delay: number;
}

const sets: Record<'hero' | 'closing' | 'auth', Disc[]> = {
  hero: [
    { cat: 'film', x: -12, y: 6, size: 30, delay: 0 },
    { cat: 'podcasts', x: -4, y: 46, size: 18, delay: 300 },
    { cat: 'music', x: 76, y: -6, size: 26, delay: 150 },
    { cat: 'books', x: 88, y: 34, size: 20, delay: 450 },
    { cat: 'games', x: 62, y: 52, size: 16, delay: 600 },
  ],
  auth: [
    { cat: 'music', x: 60, y: -10, size: 20, delay: 0 },
    { cat: 'books', x: 90, y: 34, size: 9, delay: 600 },
    { cat: 'film', x: 74, y: 56, size: 17, delay: 200 },
    { cat: 'games', x: 62, y: 84, size: 16, delay: 400 },
  ],
  closing: [
    { cat: 'games', x: -14, y: 62, size: 36, delay: 0 },
    { cat: 'film', x: 6, y: 78, size: 30, delay: 150 },
    { cat: 'books', x: 72, y: -20, size: 38, delay: 300 },
    { cat: 'music', x: 86, y: 10, size: 30, delay: 450 },
    { cat: 'podcasts', x: 66, y: 58, size: 22, delay: 600 },
  ],
};

/**
 * The art: each category's audience as a disc, overlapping where tastes meet, which is what
 * Oraqul measures. Decoration only, so it is hidden from screen readers. Never put it inside a
 * transformed layer: that isolates the discs and their blend mode stops mixing with the page.
 */
export function TasteDiscs({ set, className }: { set: keyof typeof sets; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className ?? ''}`}>
      {sets[set].map((d, i) => (
        <span
          key={d.cat}
          data-cat={d.cat}
          className="mk-disc"
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: `${d.size}vw`,
              height: `${d.size}vw`,
              maxWidth: `${d.size * 12}px`,
              maxHeight: `${d.size * 12}px`,
              '--delay': `${d.delay}ms`,
              '--t': `${16 + i * 3}s`,
              '--dx': `${i % 2 ? -14 : 14}px`,
              '--dy': `${i % 2 ? 18 : -18}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
