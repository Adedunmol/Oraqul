import { Chip, Icon, VerdictPill } from '@oraqul/ui';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

export const cases = [
  { id: 'plan', title: 'Make a plan', line: 'You have a title and no plan yet.' },
  {
    id: 'check',
    title: 'Check my plan',
    line: 'You have a plan and want to know where it is weak.',
  },
  {
    id: 'fix',
    title: 'Fix one that missed',
    line: 'It is out and the numbers are not what you hoped.',
  },
  { id: 'whatif', title: 'Test a what if', line: 'You are weighing a date, a city or a partner.' },
] as const;

/** The page title's companion: the four jobs as a large index that jumps to each. */
export function CaseIndex() {
  return (
    <ol className="flex flex-col">
      {cases.map((c, i) => (
        <li key={c.id}>
          <a
            href={`#${c.id}`}
            className="group flex items-baseline gap-5 border-b border-line py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-display text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.03em] transition-colors duration-150 group-hover:text-accent">
                {c.title}
              </span>
              <span className="text-[14.5px] text-ink/70">{c.line}</span>
            </span>
            <Icon
              name="chevron"
              className="size-5 shrink-0 text-muted transition-transform duration-150 group-hover:translate-y-0.5"
            />
          </a>
        </li>
      ))}
    </ol>
  );
}

function CaseText({
  title,
  when,
  prompt,
  gets,
  brings,
  tabs,
  example,
}: {
  title: string;
  when: string;
  prompt: string;
  gets: string;
  brings: string;
  tabs: string[];
  example?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className={h2Class}>{title}</h2>
      <p className="max-w-[44ch] text-[18px] leading-[1.55] text-ink/75">{when}</p>
      <p className="max-w-[48ch] rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-[1.5]">
        <span className="sr-only">You might type: </span>“{prompt}”
      </p>
      <dl className="grid gap-4 text-[15px] sm:grid-cols-[110px_1fr]">
        <dt className="font-medium">You get</dt>
        <dd className="flex flex-col gap-2.5">
          <span className="text-ink/75">{gets}</span>
          <span className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </span>
        </dd>
        <dt className="font-medium">You bring</dt>
        <dd className="text-ink/75">{brings}</dd>
      </dl>
      {example ? (
        <Link
          href={example}
          className="inline-flex w-fit items-center gap-1.5 text-[15px] font-medium text-accent hover:underline"
        >
          See an example
          <Icon name="chevron" className="size-4 -rotate-90" />
        </Link>
      ) : null}
    </div>
  );
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Reveal className="flex flex-col gap-4 rounded-2xl bg-card p-[clamp(16px,3vw,28px)] shadow-md">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
          Example
        </span>
      </div>
      {children}
    </Reveal>
  );
}

const ladder: [string, number, string][] = [
  ['Lagos', 1.82, 'Strong'],
  ['London', 1.64, 'Strong'],
  ['Toronto', 1.41, 'Usable'],
  ['Houston', 1.33, 'Usable'],
  ['Manchester', 1.08, 'Low lift'],
];

export function PlanCase() {
  return (
    <section id="plan" aria-label="Make a plan" className={`${band} scroll-mt-16`}>
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[0.9fr_1.1fr] min-[1000px]:items-center`}
      >
        <CaseText
          title="Make a plan"
          when="You have a title, a rough window and a hunch about the audience. Oraqul builds the plan from what that audience actually likes."
          prompt="Plan the release of Harmattan, a Lagos crime drama series, for the UK and the US."
          gets="The audience, comparable titles, the places to open in order, partner brands, and the risks to watch."
          brings="A title and a short description. Files help but are optional."
          tabs={['Summary', 'Audience', 'Plan', 'Territories', 'Evidence']}
          example="/examples?case=film&tab=territories"
        />
        <Frame label="Where to open, ranked by lift">
          <ol className="flex flex-col gap-2">
            {ladder.map(([city, lift, band], i) => (
              <li
                key={city}
                className="mk-in grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-xl bg-inset px-3.5 py-3"
                style={stagger(i)}
              >
                <span className="text-[14.5px] font-medium">{city}</span>
                <span className="h-2 rounded-sm bg-surface2">
                  <span
                    className="mk-grow block h-full rounded-sm bg-accent"
                    style={{ width: `${(lift / 2) * 100}%`, ...stagger(i + 1) }}
                  />
                </span>
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="tabular-nums">{lift.toFixed(2)}</span>
                  <Chip className="max-[520px]:hidden">{band}</Chip>
                </span>
              </li>
            ))}
          </ol>
        </Frame>
      </div>
    </section>
  );
}

const audit: { belief: string; verdict: 'holds' | 'weak' | 'breaks' | 'cant'; better?: string }[] =
  [
    { belief: 'Women 25 to 34 are the core audience', verdict: 'holds' },
    { belief: 'Open in the UK first', verdict: 'breaks', better: 'Open in Canada first' },
    { belief: 'Partner with a late night radio show', verdict: 'weak' },
    { belief: 'Pre sales will cover the spend', verdict: 'cant' },
  ];

export function CheckCase() {
  return (
    <section
      id="check"
      aria-label="Check my plan"
      className={`scheme-dark bg-bg ${band} scroll-mt-16`}
    >
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[1.1fr_0.9fr] min-[1000px]:items-center`}
      >
        <div className="order-2 min-[1000px]:order-1">
          <Frame label="Your plan, checked">
            <ul className="flex flex-col gap-2">
              {audit.map((a, i) => (
                <li
                  key={a.belief}
                  className="mk-in flex flex-col gap-2 rounded-xl bg-inset px-4 py-3.5"
                  style={stagger(i)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span
                      className={`min-w-0 flex-1 basis-48 text-[15px] ${a.better ? 'text-muted line-through' : ''}`}
                    >
                      {a.belief}
                    </span>
                    <VerdictPill verdict={a.verdict} />
                  </div>
                  {a.better ? (
                    <span className="w-fit rounded-md bg-accent-soft px-2 py-1 text-[14px] font-medium text-accent">
                      Stronger option: {a.better}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Frame>
        </div>
        <div className="order-1 min-[1000px]:order-2">
          <CaseText
            title="Check my plan"
            when="Before you commit money, find out which beliefs in your plan the data supports and which it does not."
            prompt="Check my plan: open in the UK, then Canada. Our core audience is women 25 to 34."
            gets="Every belief marked Holds, Weak, Breaks or Could not test, with a stronger option for anything that breaks."
            brings="Your plan, pasted or as a file."
            tabs={['Summary', 'Assumptions', 'Plan', 'Evidence']}
            example="/examples?case=music&tab=assumptions"
          />
        </div>
      </div>
    </section>
  );
}

const bands: [string, number, number][] = [
  ['18 to 24', 30, 12],
  ['25 to 34', 55, 28],
  ['35 to 44', 15, 60],
];

export function FixCase() {
  return (
    <section
      id="fix"
      aria-label="Fix one that missed"
      className={`bg-accent-soft ${band} scroll-mt-16`}
    >
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="grid gap-10 min-[1000px]:grid-cols-[1fr_1fr]">
          <CaseText
            title="Fix one that missed"
            when="It is out and the people who came are not the people you planned for. Oraqul finds the belief that broke and rebuilds around who showed up."
            prompt="It missed. Here are our results by region and age band."
            gets="Who came against who the plan expected, the belief that broke, a plan built around the real audience, and what to stop."
            brings="Your results by region or age band, typed, pasted or as a file. They are kept as totals."
            tabs={['Summary', 'Results', 'What changed', 'Plan']}
            example="/examples?case=podcasts"
          />
          <Frame label="Planned against actual, by age band">
            <div className="flex flex-wrap gap-4 text-[13px] text-muted">
              <span className="flex items-center gap-2">
                <span className="h-2 w-5 rounded-sm bg-muted" /> Planned
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-5 rounded-sm bg-accent" /> Actual
              </span>
            </div>
            {bands.map(([label, planned, actual], i) => (
              <div key={label} className="mk-in flex flex-col gap-2" style={stagger(i)}>
                <div className="flex justify-between text-[14.5px]">
                  <span className="font-medium">Ages {label}</span>
                  <span className="text-muted tabular-nums">
                    {planned}% planned · {actual}% actual
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="h-3 rounded-sm bg-surface2">
                    <span
                      className="mk-grow block h-full rounded-sm bg-muted"
                      style={{ width: `${planned}%`, ...stagger(i) }}
                    />
                  </span>
                  <span className="h-3 rounded-sm bg-surface2">
                    <span
                      className="mk-grow block h-full rounded-sm bg-accent"
                      style={{ width: `${actual}%`, ...stagger(i + 1) }}
                    />
                  </span>
                </div>
              </div>
            ))}
            <p className="mt-2 rounded-xl bg-inset px-4 py-3 text-[14.5px]">
              <span className="font-semibold">What broke:</span> the plan bet on 25 to 34. The
              people who came were 35 to 44, so the next wave is planned around them.
            </p>
          </Frame>
        </div>
      </div>
    </section>
  );
}

const weeks: { day: string; rival?: string; overlap: string; best?: boolean }[] = [
  { day: 'Fri 7 March', rival: 'Two crime dramas', overlap: 'Risky overlap' },
  { day: 'Fri 14 March', overlap: 'Low overlap', best: true },
  { day: 'Fri 21 March', rival: 'One thriller', overlap: 'Moderate overlap' },
  { day: 'Fri 28 March', rival: 'The biggest rival', overlap: 'Risky overlap' },
];

export function WhatIfCase() {
  return (
    <section id="whatif" aria-label="Test a what if" className={`bg-bg ${band} scroll-mt-16`}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="grid gap-10 min-[1000px]:grid-cols-[1fr_1fr] min-[1000px]:items-end">
          <h2 className={h2Class}>Test a what if</h2>
          <p className="max-w-[46ch] text-[18px] leading-[1.55] text-ink/75">
            Ask before you lock a date, a city or a partner. Oraqul compares the options against the
            same audience and says which one is safer, with the receipt for each.
          </p>
        </div>
        <Reveal className="grid gap-3 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-4">
          {weeks.map((w, i) => (
            <div
              key={w.day}
              className={`mk-in flex min-h-44 flex-col gap-3 rounded-2xl p-5 ${w.best ? 'bg-ink text-bg' : 'bg-canvas'}`}
              style={stagger(i)}
            >
              <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">
                {w.day}
              </span>
              <span className={`text-[14.5px] ${w.best ? 'opacity-80' : 'text-ink/70'}`}>
                {w.rival ? `Opening that week: ${w.rival.toLowerCase()}` : 'No rival release'}
              </span>
              <span
                className={`mt-auto w-fit rounded-md px-2.5 py-1 text-[13px] font-medium ${w.best ? 'bg-bg text-ink' : 'bg-card'}`}
              >
                {w.overlap}
              </span>
            </div>
          ))}
        </Reveal>
        <div className="grid gap-6 border-t border-line pt-8 text-[15px] sm:grid-cols-3">
          <p>
            <span className="font-medium">You might type: </span>
            <span className="text-ink/75">“What if a rival series opens the same weekend?”</span>
          </p>
          <p>
            <span className="font-medium">You get: </span>
            <span className="text-ink/75">
              the overlap for each option, lower is better, and what changes in the plan.
            </span>
          </p>
          <p>
            <span className="font-medium">You bring: </span>
            <span className="text-ink/75">the options you are weighing.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
