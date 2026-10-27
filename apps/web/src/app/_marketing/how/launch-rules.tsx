import { Confidence, DirectionPill } from '@oraqul/ui';
import { band, h2Class, leadClass, wrap } from '../section';

// Invented example data, labelled as such. Nothing here comes from Qloo.

function Example() {
  return (
    <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
      Example
    </span>
  );
}

const territories = [
  {
    name: 'Lagos',
    role: 'Home market',
    direction: 'okay',
    confidence: 'high',
    channels: 'Instagram, TikTok, YouTube',
  },
  {
    name: 'London',
    role: 'Diaspora city',
    direction: 'okay',
    confidence: 'medium',
    channels: 'YouTube, Instagram, TikTok',
  },
  {
    name: 'Houston',
    role: 'Diaspora city',
    direction: 'risky',
    confidence: 'medium',
    channels: 'YouTube, Instagram, TikTok',
  },
  {
    name: 'Atlanta',
    role: 'Diaspora city',
    direction: 'avoid',
    confidence: 'lower',
    channels: 'YouTube, Instagram, TikTok',
  },
] as const;

/** One plan per territory: the home market first, then the diaspora cities, each with its call. */
export function Territories() {
  return (
    <section aria-labelledby="territories-title" className={`bg-bg ${band}`}>
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[0.8fr_1.2fr] min-[1000px]:items-center`}
      >
        <div className="flex flex-col gap-6">
          <h2 id="territories-title" className={h2Class}>
            One plan for each place you open.
          </h2>
          <p className={leadClass}>
            Home first, then the diaspora cities. Each territory gets its own call, its lead
            channels and its partners, and a call on something you chose keeps your choice and says
            how to handle it.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-[clamp(18px,3vw,32px)] shadow-lg">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold">Night Ferry, territories</span>
            <Example />
          </div>
          <ol className="flex flex-col gap-2.5">
            {territories.map((t, i) => (
              <li
                key={t.name}
                className="grid gap-x-4 gap-y-1.5 rounded-xl bg-inset px-4 py-3.5 min-[640px]:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                    {i + 1}. {t.name}
                    <span className="ml-2 rounded bg-accent-soft px-1.5 py-px align-middle text-[11px] font-semibold text-accent">
                      {t.role}
                    </span>
                  </span>
                  <span className="text-[13.5px] text-muted">Lead on {t.channels}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 min-[640px]:justify-end">
                  <DirectionPill direction={t.direction} />
                  <Confidence level={t.confidence} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const calendar = [
  ['T-26 to T-16', 'Lock the key art and set up the sales and presale page.'],
  ['T-12', 'Release the first trailer and open advance screening sign-ups.'],
  ['T-10 to T-6', 'Book advance screenings with community groups in each territory.'],
  ['T-8', 'Open presales and read the first week against the target.'],
  ['T-1', 'Premiere in the home market; the other territories follow within days.'],
] as const;

const tiers = [
  [
    'A',
    'Flagship',
    'Only for releases with scale.',
    'Out for micro and for a solo launcher. On an independent budget a stretch for an established or major launcher, otherwise out',
  ],
  [
    'B',
    'Category and integration',
    'Banks and payments, food and drink, hospitality, telecom.',
    'A stretch for micro or a solo launcher',
  ],
  ['C', 'Local', 'Cinemas, creators, diaspora businesses, community groups.', 'Fits every budget'],
] as const;

/** The craft around the data: a dated calendar and one signal, briefs not ads, partners by tier. */
export function Craft() {
  return (
    <section aria-labelledby="craft-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="flex flex-col gap-5 min-[900px]:max-w-[62%]">
          <h2 id="craft-title" className={h2Class}>
            The craft around the data, written down.
          </h2>
          <p className={leadClass}>
            Every category plans by a versioned set of launch rules, each with its source and date.
            You can read them, and each plan says which version it used.
          </p>
        </div>

        <div className="grid gap-4 min-[1000px]:grid-cols-3">
          <article className="flex flex-col gap-4 rounded-2xl bg-card p-6">
            <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
              Worked back from your date
            </h3>
            <p className="text-[15px] leading-[1.55] text-ink/75">
              Film plans run months. Music rollouts run six to eight weeks. Books send advance
              copies two to three months out. The calendar is written by code, and a beat already
              over is dropped.
            </p>
            <ul className="flex flex-col gap-2 text-[14px]">
              {calendar.map(([when, what]) => (
                <li
                  key={when}
                  className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-lg bg-inset px-3 py-2"
                >
                  <b className="font-mono text-[12.5px] text-accent">{when}</b>
                  <span>{what}</span>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-[14px] text-accent">
              One signal to judge it on: advance screenings and presales. Your target, not a
              forecast.
            </p>
          </article>

          <article className="flex flex-col gap-4 rounded-2xl bg-card p-6">
            <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
              Briefs and scripts, never ads
            </h3>
            <p className="text-[15px] leading-[1.55] text-ink/75">
              Oraqul writes what a team needs to make the creative. A person makes the final
              trailer, ad or image.
            </p>
            <div className="flex flex-col gap-2 rounded-xl bg-inset p-4 text-[14px] leading-[1.55]">
              <b className="text-[13px] text-muted">Lagos · Instagram</b>
              <span>
                <b>Hook one:</b> open on the strongest image, in the first two seconds.
              </span>
              <span>
                <b>Script, 25 seconds:</b> the hook, who it is for, the proof, the ask and the date.
              </span>
              <span>
                <b>Shot list:</b> five shots, from the core moment to the title card.
              </span>
              <span>
                <b>Key art brief:</b> one image, the title, one line. Oraqul does not draw it.
              </span>
            </div>
            <p className="text-[13px] text-muted">
              Hooks, scripts, shot lists, key art briefs and caption packs, for one territory and
              channel, or for every territory when you ask for all of them.
            </p>
          </article>

          <article className="flex flex-col gap-4 rounded-2xl bg-card p-6">
            <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
              Partners that fit the launch
            </h3>
            <p className="text-[15px] leading-[1.55] text-ink/75">
              Qloo finds the brands your audience likes in each category and city, and ranks them
              next to the city's own taste. Each partner shows its Qloo fit and whether the budget
              and who is launching can reach it. Price is always unknown. A flagship that the launch
              cannot reach is listed apart as a goal for later, and never written into the plan's
              moves unless you named it.
            </p>
            <ul className="flex flex-col gap-2">
              {tiers.map(([tier, name, what, fit]) => (
                <li key={tier} className="flex flex-col gap-0.5 rounded-xl bg-inset px-3.5 py-3">
                  <b className="text-[14.5px]">
                    Tier {tier}, {name}
                  </b>
                  <span className="text-[13.5px] text-ink/75">{what}</span>
                  <span className="text-[12.5px] text-muted">{fit}. Price: unknown.</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
