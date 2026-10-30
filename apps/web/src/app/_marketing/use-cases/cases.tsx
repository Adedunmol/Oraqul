import { Chip, Icon, VerdictPill } from '@oraqul/ui';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { exampleBriefs, exampleDetails } from '@/lib/examples';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

export const cases = [
  {
    id: 'plan',
    title: 'Make a plan',
    line: 'You have a title and no plan yet.',
  },
  {
    id: 'check',
    title: 'Check my plan',
    line: 'You have a plan and want to know where it is weak.',
  },
  {
    id: 'fix',
    title: 'Fix my plan',
    line: 'It is out and the numbers are not what you hoped.',
  },
  {
    id: 'campaign',
    title: 'Run the campaign',
    line: 'You have a plan and a date, and a team to run it.',
  },
  {
    id: 'whatif',
    title: 'Keep going',
    line: 'You are weighing a date, a city, a partner or the creative.',
  },
] as const;

export function CaseIndex() {
  return (
    <ol className="flex flex-col">
      {cases.map((c) => (
        <li key={c.id}>
          <a
            href={`#${c.id}`}
            className="group flex items-baseline gap-5 border-b border-line py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-display text-[clamp(22px,2.4vw,30px)] font-medium tracking-[-0.03em] transition-colors duration-150 group-hover:text-accent">
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

function Tabs({ tabs }: { tabs: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Chip key={t}>{t}</Chip>
      ))}
    </span>
  );
}

function ExampleLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-[15px] font-medium text-accent hover:underline"
    >
      See an example
      <Icon name="chevron" className="size-4 -rotate-90" />
    </Link>
  );
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <p className="mk-in max-w-[46ch] self-end rounded-xl bg-inset px-4 py-3 text-[16px] leading-[1.65]">
      <span className="sr-only">You might type: </span>“{children}”
    </p>
  );
}

/** "Real run" for what comes from a recorded plan; "Illustration" for a sketch of a job no run backs. */
function ExampleTag({ real = false }: { real?: boolean }) {
  return (
    <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
      {real ? 'Real run' : 'Illustration'}
    </span>
  );
}

// The cities of the recorded film run, strongest first, with the band the code gave each.
const ladder: [string, number, string][] = [...exampleDetails.film.output.brief.places]
  .sort((a, b) => b.lift - a.lift)
  .map((p) => [p.name, p.lift, `${p.band.charAt(0).toUpperCase()}${p.band.slice(1)}`]);

/** Make a plan reads as the chat it is: the ask on the right, the agent's answer under it. */
export function PlanCase() {
  return (
    <section id="plan" aria-label="Make a plan" className={`${band} scroll-mt-16`}>
      <div className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[0.8fr_1.2fr]`}>
        <div className="flex flex-col gap-6 min-[1000px]:sticky min-[1000px]:top-28 min-[1000px]:self-start">
          <h2 className={h2Class}>Make a plan</h2>
          <p className="max-w-[40ch] text-[18px] leading-[1.65] text-ink/75">
            You have a title, a rough window and a hunch about the audience. Oraqul builds the plan
            from what that audience actually likes.
          </p>
          <p className="max-w-[40ch] text-[16px] leading-[1.65] text-ink/75">
            <span className="font-medium text-ink">You bring </span>a title and a short description.
            Files help but are optional.
          </p>
          <ExampleLink href="/examples?case=film&tab=territories" />
        </div>
        <Reveal className="flex flex-col gap-5">
          <UserBubble>{exampleBriefs.film}</UserBubble>
          <div className="mk-in flex flex-col gap-4" style={stagger(1)}>
            <span className="text-[14px] font-semibold text-accent">Oraqul</span>
            <div className="flex flex-col gap-4 rounded-2xl bg-card p-[clamp(16px,3vw,24px)] shadow-md">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="font-semibold">Where to open, ranked by lift</span>
                <ExampleTag real />
              </div>
              <ol className="flex flex-col">
                {ladder.map(([city, lift, tier], i) => (
                  <li
                    key={city}
                    className="mk-in grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-line py-3 last:border-0"
                    style={stagger(i + 2)}
                  >
                    <span className="text-[14.5px] font-medium">{city}</span>
                    <span className="h-2 rounded-sm bg-surface2">
                      <span
                        className="mk-grow block h-full rounded-sm bg-accent"
                        style={{
                          width: `${(lift / 2) * 100}%`,
                          ...stagger(i + 3),
                        }}
                      />
                    </span>
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className="tabular-nums">{lift.toFixed(2)}</span>
                      <Chip className="max-[520px]:hidden">{tier}</Chip>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-[16px] leading-[1.65] text-ink/75">
              Also in the plan: the audience, comparable titles, partner brands and the risks to
              watch.
            </p>
            <Tabs
              tabs={[
                'Plan',
                'Territories',
                'Direction calls',
                'Audience',
                'Assumptions',
                'Evidence',
              ]}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const audit: {
  belief: string;
  verdict: 'holds' | 'weak' | 'breaks' | 'cant';
  better?: string;
}[] = [
  { belief: 'Women 25 to 34 are the core audience', verdict: 'holds' },
  {
    belief: 'Open in the UK first',
    verdict: 'breaks',
    better: 'Open in Canada first',
  },
  { belief: 'Partner with a late night radio show', verdict: 'weak' },
  { belief: 'Pre sales will cover the spend', verdict: 'cant' },
];

/** Check my plan is a ledger: one belief per line, the verdict beside it, the fix at the end. */
export function CheckCase() {
  return (
    <section
      id="check"
      aria-label="Check my plan"
      className={`scheme-dark bg-bg ${band} scroll-mt-16`}
    >
      <div className={`${wrap} flex flex-col gap-12`}>
        <div className="flex flex-col gap-6">
          <h2 className={`${h2Class} max-w-[16ch]`}>Check my plan</h2>
          <p className="max-w-[52ch] text-[clamp(18px,2vw,24px)] leading-[1.4] text-ink/75">
            <span className="sr-only">You might type: </span>“Check my plan: open in the UK, then
            Canada. Our core audience is women 25 to 34.”
            <span aria-hidden="true" className="mk-caret" />
          </p>
        </div>
        <Reveal>
          <div className="mb-3 flex items-center justify-between gap-3 text-[13px] text-muted">
            <span>Your plan, assumption by assumption</span>
            <ExampleTag />
          </div>
          <ul className="border-t border-line">
            {audit.map((a, i) => (
              <li
                key={a.belief}
                className="mk-in grid items-center gap-x-6 gap-y-2 border-b border-line py-5 min-[900px]:grid-cols-[1.3fr_auto_1fr]"
                style={stagger(i)}
              >
                <span
                  className={`font-display text-[clamp(18px,1.9vw,24px)] tracking-[-0.02em] ${a.better ? 'text-muted line-through' : ''}`}
                >
                  {a.belief}
                </span>
                <span className="w-fit">
                  <VerdictPill verdict={a.verdict} />
                </span>
                {a.better ? (
                  <span className="w-fit rounded-md bg-accent-soft px-2 py-1 text-[14px] font-medium text-accent">
                    Stronger option: {a.better}
                  </span>
                ) : (
                  <span aria-hidden="true" className="max-[899px]:hidden" />
                )}
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="flex flex-col gap-3 text-[15px] text-ink/75 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
          <p className="max-w-[60ch]">
            Every assumption is marked Holds, Weak, Breaks or Could not test, with a stronger option
            for anything that breaks. Bring your plan, pasted or as a file.
          </p>
          <ExampleLink href="/examples?case=music&tab=plan" />
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

/** Fix my plan leads with the picture: planned against actual as paired columns. */
export function FixCase() {
  return (
    <section
      id="fix"
      aria-label="Fix my plan"
      className={`mk-lit bg-accent-soft ${band} scroll-mt-16`}
    >
      <div
        className={`${wrap} grid gap-12 min-[1000px]:grid-cols-[1.2fr_0.8fr] min-[1000px]:items-end`}
      >
        <Reveal className="flex flex-col gap-6 rounded-2xl bg-card p-[clamp(16px,3vw,28px)] shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
            <span className="font-semibold">Planned against actual, by age band</span>
            <span className="flex items-center gap-4 text-muted">
              <span className="flex items-center gap-2">
                <span className="h-2 w-4 rounded-sm bg-muted" /> Planned
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-4 rounded-sm bg-accent" /> Actual
              </span>
              <ExampleTag />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-[clamp(12px,3vw,40px)] border-b border-line">
            {bands.map(([label, planned, actual], i) => (
              <div key={label} className="flex flex-col gap-3">
                <div className="flex h-56 items-end gap-1.5">
                  {[
                    [planned, 'bg-muted'],
                    [actual, 'bg-accent'],
                  ].map(([v, fill]) => (
                    <div
                      key={fill}
                      className="mk-in flex h-full flex-1 flex-col justify-end gap-1.5"
                      style={stagger(i)}
                    >
                      <span className="text-center text-[13px] tabular-nums text-muted">{v}%</span>
                      <span
                        className={`block rounded-t-sm ${fill}`}
                        style={{ height: `${(Number(v) / 70) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
                <span className="pb-3 text-center text-[14px] font-medium">Ages {label}</span>
              </div>
            ))}
          </div>
          <p className="text-[16px] leading-[1.65]">
            <span className="font-semibold">What broke:</span> the plan bet on 25 to 34. The people
            who came were 35 to 44, so the next wave is planned around them.
          </p>
        </Reveal>
        <div className="flex flex-col gap-6">
          <h2 className={h2Class}>Fix my plan</h2>
          <p className="max-w-[40ch] text-[18px] leading-[1.65] text-ink/75">
            It is out and the people who came are not the people you planned for. Oraqul finds the
            assumption that broke and rebuilds around who showed up.
          </p>
          <p className="max-w-[40ch] text-[16px] leading-[1.65] text-ink/75">
            <span className="font-medium text-ink">You bring </span>your results by region or age
            band, typed, pasted or as a file. They are kept as totals.
          </p>
          <ExampleLink href="/examples?case=podcasts" />
        </div>
      </div>
    </section>
  );
}

const weeks: {
  day: string;
  rival?: string;
  overlap: string;
  best?: boolean;
}[] = [
  { day: 'Fri 7 March', rival: 'Two crime dramas', overlap: 'Risky overlap' },
  { day: 'Fri 14 March', overlap: 'Low overlap', best: true },
  { day: 'Fri 21 March', rival: 'One thriller', overlap: 'Moderate overlap' },
  { day: 'Fri 28 March', rival: 'The biggest rival', overlap: 'Risky overlap' },
];

/** Keep going lays the options out as the weeks they are, with the safest one raised. */
export function WhatIfCase() {
  return (
    <section id="whatif" aria-label="Keep going" className={`bg-bg ${band} scroll-mt-16`}>
      <div className={`${wrap} flex flex-col items-center gap-12`}>
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className={h2Class}>Keep going</h2>
          <p className="max-w-[46ch] text-[18px] leading-[1.65] text-ink/75">
            Ask before you lock a date, a city or a partner, then make the creative kit. Oraqul
            compares the options against the same audience and says which one is safer, with the
            receipt for each.
          </p>
        </div>
        <Reveal className="grid w-full gap-3 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-4 min-[1000px]:items-end">
          {weeks.map((w, i) => (
            <div
              key={w.day}
              className={`mk-in flex flex-col gap-3 rounded-2xl p-5 ${w.best ? 'bg-ink text-bg min-[1000px]:min-h-60' : 'min-h-44 bg-canvas'}`}
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
        <div className="flex max-w-[60ch] flex-col items-center gap-4 text-center">
          <p className="rounded-xl bg-inset px-4 py-3 text-[16px] leading-[1.65]">
            <span className="sr-only">You might type: </span>“What if a rival series opens the same
            weekend?”
          </p>
          <p className="text-[16px] leading-[1.65] text-ink/75">
            You get the overlap for each option, lower is better, and what changes in the plan. Give
            real rivals with the day each opens: “Rivals: Harbor Lights on 2027-03-12”.
          </p>
          <p className="text-[16px] leading-[1.65] text-ink/75">
            For a single live show, a rival on your night or in your week is flagged as okay, risky
            or avoid, and the on-sale plan, the presale and the final push are worked back from your
            show date.
          </p>
        </div>
      </div>
    </section>
  );
}

const actions: { when: string; what: string; channel: string; state: 'todo' | 'doing' | 'done' }[] =
  [
    {
      when: 'T-4 weeks',
      what: 'Offer the trailer to one outlet first',
      channel: 'Instagram',
      state: 'done',
    },
    { when: 'T-3 weeks', what: 'Teaser, 10 to 30 seconds', channel: 'Instagram', state: 'doing' },
    { when: 'T-2 weeks', what: 'Pitch podcasts', channel: 'Email', state: 'todo' },
    { when: 'Launch week', what: 'Something new every day', channel: 'Instagram', state: 'todo' },
  ];

const STATES = [
  ['todo', 'To do'],
  ['doing', 'Doing'],
  ['done', 'Done'],
] as const;

/**
 * Run the campaign, drawn the way the product draws it: the Campaign tab's action rows with their
 * status buttons, and a two-angle test that can say it cannot tell.
 */
export function CampaignCase() {
  return (
    <section
      id="campaign"
      aria-label="Run the campaign"
      className={`scheme-dark bg-bg ${band} scroll-mt-16`}
    >
      <div className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[0.8fr_1.2fr]`}>
        <div className="flex flex-col gap-6 min-[1000px]:sticky min-[1000px]:top-28 min-[1000px]:self-start">
          <h2 className={h2Class}>Run the campaign</h2>
          <p className="max-w-[40ch] text-[18px] leading-[1.65] text-ink/75">
            The plan’s content calendar becomes a dated checklist in the project. Edit it, tick it
            off, and set up a test of two creative angles. Each action comes with a guide to adapt.
            Oraqul watches the dates and alerts the team, makes no final asset and posts nothing.
          </p>
          <p className="max-w-[40ch] text-[16px] leading-[1.65] text-ink/75">
            Add your own figures for the two angles and Oraqul compares them. When they are thin or
            close it says inconclusive, and it never names a cause as fact.
          </p>
        </div>
        <Reveal className="product-face flex flex-col gap-3">
          <p className="mk-in text-[13.5px] text-muted" style={stagger(0)}>
            These actions belong to v2 · Night Ferry. A revised plan gets its own set, and this one
            stays as you left it. Example.
          </p>
          <ul className="flex flex-col gap-2.5">
            {actions.map((a, i) => (
              <li
                key={a.what}
                className="mk-in flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-3.5"
                style={stagger(i + 1)}
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-muted">
                    {a.when} · {a.channel}
                  </p>
                  <p
                    className={`text-[15px] font-medium ${a.state === 'done' ? 'text-muted line-through' : ''}`}
                  >
                    {a.what}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">Playbook</p>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {STATES.map(([value, label]) => (
                    <span
                      key={value}
                      className={`inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium ${a.state === value ? 'bg-accent text-primary-ink' : 'bg-surface2 text-ink'}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div
            className="mk-in flex flex-col gap-2.5 rounded-xl bg-card px-4 py-3.5"
            style={stagger(actions.length + 1)}
          >
            <div className="flex flex-col gap-2.5 rounded-lg bg-bg px-4 py-3">
              <p className="text-[13.5px] font-medium">Two-angle test</p>
              <p className="text-[15.5px] leading-[1.65]">
                <span className="font-medium">Angle A: the audience’s tone.</span> Take the tone
                from noir and road trip.{' '}
                <span className="text-[12.5px] text-muted">Grounded in your audience’s taste</span>
              </p>
              <p className="text-[15.5px] leading-[1.65]">
                <span className="font-medium">Angle B: the city itself.</span> Open on New York
                itself, with the name on screen.{' '}
                <span className="text-[12.5px] text-muted">Playbook</span>
              </p>
              <p className="text-[15.5px] leading-[1.65]">
                <span className="font-medium">Your figures.</span> Angle A 120, angle B 104
                conversions, week one. Source: the ad manager.
              </p>
              <p className="text-[15.5px] leading-[1.65]">
                <span className="font-medium">Inconclusive.</span> The two are within 20% of each
                other (120 and 104 conversions), too close to call.
              </p>
              <p className="text-[13.5px] text-muted">
                Oraqul does not predict which angle will win.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
