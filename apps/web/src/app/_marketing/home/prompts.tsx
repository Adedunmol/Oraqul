import type { Category } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';
import { h2Class, wrap } from '../section';

const rows: [Category, string][][] = [
  [
    ['film', 'Which territories should Harmattan open in first?'],
    ['music', 'Plan a six city tour for an Afrobeats album, starting in Lagos.'],
    ['books', 'Which comparable novels share readers with my debut?'],
    ['games', 'Which fan bases outside gaming overlap with our players?'],
    ['podcasts', 'Which topics do my listeners like that rival shows do not own?'],
  ],
  [
    ['podcasts', 'Season two missed. Here are downloads by country.'],
    ['film', 'What if a rival crime drama opens the same weekend?'],
    ['music', 'Which support act fits best in Toronto and Houston?'],
    ['books', 'Check my plan: lead with the audiobook in the UK.'],
    ['games', 'Which regions should the co op survival game open in?'],
  ],
];

function Prompt({ cat, text }: { cat: Category; text: string }) {
  return (
    <li
      data-cat={cat}
      className="mr-3 flex shrink-0 items-center gap-3 rounded-2xl bg-card py-3 pr-5 pl-3 text-[15px]"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--cat)_22%,var(--card))] text-cat">
        <Icon name={cat} className="size-4" />
      </span>
      <span className="whitespace-nowrap">{text}</span>
    </li>
  );
}

/** What people type, scrolling past in both directions: the message box is the whole interface. */
export function Prompts() {
  return (
    <section
      aria-labelledby="prompts-title"
      className="scheme-dark bg-bg pb-[clamp(72px,10vw,144px)]"
    >
      <div
        className={`${wrap} grid gap-6 pb-14 min-[900px]:grid-cols-[1.2fr_1fr] min-[900px]:items-end`}
      >
        <h2 id="prompts-title" className={h2Class}>
          One message. That is how every project starts.
        </h2>
        <p className="max-w-[44ch] text-[17px] leading-[1.55] text-muted min-[900px]:justify-self-end">
          Type it the way you would say it to a colleague. Oraqul works out the category and the
          job, says what it guessed, and asks only what a wrong guess would waste.
        </p>
      </div>
      <div className="mk-marquee flex flex-col gap-3 overflow-hidden">
        {rows.map((row, r) => (
          <div
            key={row[0]?.[1]}
            className="mk-track"
            data-reverse={r % 2 ? '' : undefined}
            style={{ '--t': `${70 + r * 12}s` } as CSSProperties}
          >
            <ul className="flex">
              {row.map(([cat, text]) => (
                <Prompt key={text} cat={cat} text={text} />
              ))}
            </ul>
            <ul aria-hidden="true" className="mk-dup flex">
              {row.map(([cat, text]) => (
                <Prompt key={text} cat={cat} text={text} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
