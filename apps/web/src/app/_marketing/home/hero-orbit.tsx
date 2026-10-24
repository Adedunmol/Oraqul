import type { Category } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';

const cats: Category[] = ['film', 'music', 'books', 'podcasts', 'games', 'shows'];
const RADIUS = 36;

/**
 * Hero art, faint and with no words so it adds nothing to the text. Tiles use each category's
 * colour.
 */
export function HeroOrbit() {
  const nodes = cats.map((cat, i) => {
    const angle = ((-90 + i * (360 / cats.length)) * Math.PI) / 180;
    return { cat, x: 50 + RADIUS * Math.cos(angle), y: 50 + RADIUS * Math.sin(angle) };
  });
  return (
    <div
      aria-hidden="true"
      className="mk-orbit pointer-events-none relative -mt-2 -mb-6 aspect-square w-[min(74vw,320px)] self-center min-[1000px]:absolute min-[1000px]:top-[4%] min-[1000px]:right-[-6%] min-[1000px]:m-0 min-[1000px]:w-[min(36vw,500px)]"
    >
      <div className="mk-orbit-spin absolute inset-0">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full">
          {[RADIUS, 22].map((r) => (
            <circle
              key={r}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="var(--line)"
              strokeWidth="0.3"
            />
          ))}
          {nodes.map((n) => (
            <line
              key={n.cat}
              x1="50"
              y1="50"
              x2={n.x}
              y2={n.y}
              stroke="var(--line)"
              strokeWidth="0.3"
              strokeDasharray="1.2 1.4"
            />
          ))}
        </svg>

        {nodes.map((n, i) => (
          <span
            key={n.cat}
            data-cat={n.cat}
            className="mk-orbit-tile absolute grid size-[19%] -translate-1/2 place-items-center rounded-[26%] text-[var(--cat)]"
            style={
              {
                left: `${n.x}%`,
                top: `${n.y}%`,
                '--delay': `${300 + i * 120}ms`,
                '--t': `${14 + i * 2}s`,
                '--dx': `${i % 2 ? -6 : 6}px`,
                '--dy': `${i % 2 ? 8 : -8}px`,
              } as CSSProperties
            }
          >
            <Icon name={n.cat} className="size-[46%]" />
          </span>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="mk-orbit-ping absolute top-1/2 left-1/2 size-[17%] -translate-1/2 rounded-[28%]"
      />
      <span className="mk-orbit-hub absolute top-1/2 left-1/2 grid size-[17%] -translate-1/2 place-items-center rounded-[28%] bg-primary shadow-[var(--elev-2)]">
        <span className="size-[44%] rounded-full border-[0.35vw] border-primary-ink max-[999px]:border-[1.4px] min-[1000px]:border-[3px]" />
      </span>
    </div>
  );
}
