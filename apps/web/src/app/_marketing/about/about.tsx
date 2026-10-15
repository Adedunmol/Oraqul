import type { CSSProperties } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className={`bg-bg ${band}`}>
      <div
        className={`${wrap} grid gap-10 min-[1000px]:grid-cols-[1.2fr_0.8fr] min-[1000px]:items-end`}
      >
        <h2
          id="problem-title"
          className="font-display text-[clamp(34px,5.4vw,72px)] leading-[1] font-semibold tracking-[-0.045em] text-balance"
        >
          Launch plans are defended on instinct, and{' '}
          <span className="text-accent">instinct is hard to check.</span>
        </h2>
        <div className="flex max-w-[46ch] flex-col gap-4 text-[17px] leading-[1.65] text-ink/80">
          <p>
            A launch team bets real money on beliefs: this audience, these cities, this date. The
            data that could settle those beliefs exists, but it sits in dashboards that answer one
            question at a time, or behind chatbots that answer confidently with nothing behind them.
          </p>
          <p>
            Oraqul sits between the two. It talks like a colleague and works like an analyst who
            shows every sum.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Idea() {
  const lines = [
    [
      'A receipt for every claim',
      'The exact Qloo call behind it, what went in and what came back.',
    ],
    [
      'Numbers from code',
      'The model writes the words. Every score is computed from Qloo’s values.',
    ],
    [
      'Gaps said plainly',
      'Where the data is thin or missing, the answer says so instead of guessing.',
    ],
  ];
  return (
    <section aria-labelledby="idea-title" className={`scheme-dark mk-glow-low bg-bg ${band}`}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <h2 id="idea-title" className={`${h2Class} max-w-[16ch]`}>
          So every answer comes with its working.
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-2xl bg-line min-[900px]:grid-cols-3">
          {lines.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-4 bg-card p-[clamp(22px,3vw,36px)]">
              <span className="font-display text-[clamp(40px,4vw,56px)] leading-none font-semibold tracking-[-0.05em] text-accent">
                {i + 1}
              </span>
              <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
                {title}
              </h3>
              <p className="text-[15.5px] leading-[1.6] text-ink/75">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const ranked: [string, string, number][] = [
  ['Mexico City', 'Americas', 1.82],
  ['Seoul', 'Asia', 1.64],
  ['London', 'Europe', 1.51],
  ['Lagos', 'Africa', 1.47],
  ['Toronto', 'Americas', 1.38],
  ['Sydney', 'Oceania', 1.22],
];

/** Cities from every region in one ranking, which is the point: one list, not one per region. */
export function Markets() {
  return (
    <section aria-labelledby="markets-title" className={`${band} overflow-x-clip`}>
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[1fr_1fr] min-[1000px]:items-center`}
      >
        <div className="flex flex-col gap-6">
          <h2 id="markets-title" className={h2Class}>
            Built for launches anywhere in the world.
          </h2>
          <div className="flex max-w-[46ch] flex-col gap-4 text-[17px] leading-[1.65] text-ink/80">
            <p>
              A release rarely lives in one country. Oraqul tests titles from any market and ranks
              cities from every region in a single list, so a plan for Seoul, Mexico City and London
              is judged by the same rule.
            </p>
            <p>Where the data is thin, it says so and lowers its confidence rather than guess.</p>
          </div>
        </div>

        <figure className="flex flex-col gap-3">
          <figcaption className="sr-only">
            An example ranking by lift: Mexico City, Seoul, London, Lagos, Toronto and Sydney in one
            list.
          </figcaption>
          <Reveal className="flex flex-col gap-2 rounded-2xl bg-card p-[clamp(16px,3vw,28px)]">
            {ranked.map(([city, where, lift], i) => (
              <div
                key={city}
                className="mk-in grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-inset px-3.5 py-3"
                style={{ '--i': i } as CSSProperties}
              >
                <span className="text-[13px] text-muted tabular-nums">{i + 1}</span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{city}</span>
                    <span className="rounded-md bg-surface2 px-1.5 py-px text-[11.5px] font-medium">
                      {where}
                    </span>
                  </span>
                  <span className="h-1.5 rounded-sm bg-surface2">
                    <span
                      className="mk-grow block h-full rounded-sm bg-accent"
                      style={{ width: `${(lift / 2) * 100}%`, '--i': i } as CSSProperties}
                    />
                  </span>
                </span>
                <span className="text-[13.5px] tabular-nums">{lift.toFixed(2)}</span>
              </div>
            ))}
          </Reveal>
          <p className="text-center text-[12.5px] text-muted">
            Example ranking by lift. Real rankings depend on the title and its audience.
          </p>
        </figure>
      </div>
    </section>
  );
}
