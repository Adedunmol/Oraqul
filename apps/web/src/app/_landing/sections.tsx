import { buttonClassName, Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

const label = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';
const sectionTitle =
  'font-display text-[clamp(23px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.025em] text-balance';

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mx-auto flex w-full max-w-5xl scroll-mt-20 flex-col gap-8 px-5 py-14"
    >
      <div className="flex max-w-xl flex-col gap-3">
        <p className={label}>{eyebrow}</p>
        <h2 id={`${id}-title`} className={sectionTitle}>
          {title}
        </h2>
        <p className="text-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}

const jobs = [
  {
    title: 'Plan a launch',
    gets: 'A launch plan with the audience, comparable titles, the best places to open and partner brands.',
    brings: 'A short description of what you are launching.',
  },
  {
    title: 'Check a plan I have',
    gets: 'Each audience belief in your plan tested and marked Holds, Weak or Breaks, with a stronger option for anything that breaks.',
    brings: 'Your existing plan.',
  },
  {
    title: 'Rescue one that missed',
    gets: 'Who actually showed up compared with who the plan expected, and a relaunch plan built around them.',
    brings: 'Your results by region or age band.',
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title="One place to plan, check and rescue a launch."
      lead="Describe what you are launching. Oraqul works out the job, asks what it needs and ends with the bottom line and what to do first."
    >
      <ol className="grid gap-3 min-[800px]:grid-cols-3">
        {jobs.map((job, index) => (
          <li key={job.title} className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-lg bg-ink text-[13px] font-semibold text-bg"
            >
              {index + 1}
            </span>
            <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{job.title}</h3>
            <p className="text-muted">{job.gets}</p>
            <p className="mt-auto font-medium">You bring: {job.brings}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const categories: { id: string; icon: IconName; name: string; line: string }[] = [
  {
    id: 'film',
    icon: 'film',
    name: 'Film and series',
    line: 'Audience by age and territory, comparable titles, partner brands and overlap with rival release dates.',
  },
  {
    id: 'music',
    icon: 'music',
    name: 'Music',
    line: 'Support acts, tour cities, partner brands and diaspora cities for African artists.',
  },
  {
    id: 'books',
    icon: 'books',
    name: 'Books',
    line: 'Comparable books, audience by age and place, adaptation angles and retail partners.',
  },
  {
    id: 'podcasts',
    icon: 'podcasts',
    name: 'Podcasts',
    line: 'Audience and topic tags, sponsor brands and guest fit.',
  },
  {
    id: 'games',
    icon: 'games',
    name: 'Games',
    line: 'Comparable games, fan bases to team up with across music and film, and the regions to open first.',
  },
];

export function Categories() {
  return (
    <Section
      id="categories"
      eyebrow="Five categories"
      title="Built for the teams that launch culture."
      lead="Each category has its own questions, charts and what if tests, tuned to how that launch works."
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li
            key={category.id}
            data-cat={category.id}
            className="flex gap-4 rounded-2xl bg-surface p-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
              <Icon name={category.icon} className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold tracking-[-0.02em]">{category.name}</h3>
              <p className="text-[13.5px] text-muted">{category.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const receiptRows: [string, string][] = [
  ['Call id', 'call_8f3a'],
  ['Input', 'Lead title, Lagos, ages 25 to 34'],
  ['Returned', 'Taste fit above a neutral audience in the same place'],
  ['How it was decided', 'Computed by code from the values returned'],
];

export function Receipts() {
  return (
    <Section
      id="receipts"
      eyebrow="Receipts"
      title="Every claim links to the data behind it."
      lead="Open a receipt to see the exact Qloo call, what went in, what came back and how the verdict was decided. Scores and verdicts are computed by code from those values."
    >
      <div className="grid items-start gap-6 min-[800px]:grid-cols-2">
        <ul className="flex flex-col gap-3">
          {[
            'Holds, Weak, Breaks or Could not test on every assumption, shown as a glyph and a word.',
            'Confidence in plain words, High, Medium or Low.',
            'Only public titles, place names and age bands go to Qloo.',
          ].map((point) => (
            <li key={point} className="flex gap-3">
              <Icon name="check" className="mt-0.5 text-muted" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <section
          aria-label="Example receipt"
          className="flex flex-col gap-4 rounded-2xl bg-surface p-5"
        >
          <p className={label}>Example receipt</p>
          <dl className="flex flex-col gap-3">
            {receiptRows.map(([term, value]) => (
              <div key={term} className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-muted">{term}</dt>
                <dd className={term === 'Call id' ? 'font-mono text-xs' : undefined}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Section>
  );
}

export function ClosingCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-5 py-16"
    >
      <h2 id="cta-title" className={`${sectionTitle} max-w-md`}>
        Bring your next launch.
      </h2>
      <p className="max-w-md text-muted">
        Create an account, describe what you are launching and get a plan with receipts.
      </p>
      <Link href="/sign-up" className={buttonClassName('primary')}>
        Create account
      </Link>
    </section>
  );
}
