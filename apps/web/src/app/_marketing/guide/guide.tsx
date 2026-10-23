import { rules, TIER_LABEL } from '@oraqul/packs';
import { categories } from '@oraqul/schema';
import { DirectionPill, VerdictPill } from '@oraqul/ui';
import type { ReactNode } from 'react';
import { wrap } from '../section';
import { SectionNav } from '../section-nav';
import { CATEGORY_GUIDE, DETAILS } from './brief';
import { PromptBuilder } from './prompt-builder';

export const sections = [
  { id: 'start', title: 'Start here' },
  { id: 'builder', title: 'Build a brief' },
  { id: 'details', title: 'What matters most' },
  { id: 'categories', title: 'By category' },
  { id: 'reading', title: 'Reading a plan' },
  { id: 'after', title: 'After the plan' },
  { id: 'wont', title: 'What it will not do' },
  { id: 'rules', title: 'The launch rules' },
] as const;

const prose = 'max-w-[62ch] text-[17px] leading-[1.65] text-ink/80';

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-6 border-t border-line pt-10 first:border-0 first:pt-0"
    >
      <h2
        id={`${id}-title`}
        className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const JOBS = [
  {
    title: 'Make a plan',
    body: 'Describe the launch. You get a plan with a bottom line, a plan per territory, the one signal it is judged on and a calendar worked back from your date.',
    bring: 'A title, a release date and the cities.',
  },
  {
    title: 'Check my plan',
    body: 'Paste a plan you already have. Every belief in it is tested and marked Holds, Weak, Breaks or Could not test, with the sentence of your plan that states it.',
    bring: 'The plan, as text or a file.',
  },
  {
    title: 'Fix my plan',
    body: 'Before launch, you get a better plan that keeps your choices. After launch, add results as totals and the new plan is built around the audience that showed up.',
    bring: 'The plan, and results by city if it is out.',
  },
];

const WEAK_STRONG = [
  {
    label: 'Release date',
    weak: 'Opening in spring.',
    strong: 'Opening on 2027-03-12.',
  },
  {
    label: 'Cities',
    weak: 'Nigeria and abroad.',
    strong: 'Lagos first, then London, Houston and Atlanta.',
  },
  {
    label: 'Comps',
    weak: 'Like the big Nollywood hits.',
    strong: 'Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor".',
  },
  {
    label: 'Budget',
    weak: 'We have a small budget.',
    strong: 'An independent budget. Or: budget $40k.',
  },
  {
    label: 'Rivals',
    weak: 'There are some big releases that month.',
    strong: 'Rivals: Harbor Lights on 2027-03-12; Third Mainland on 2027-03-19',
  },
  {
    label: 'Target',
    weak: 'We want it to do well.',
    strong: 'Target 5,000 presales.',
  },
];

const READING = [
  {
    term: 'Grounded line',
    body: 'A claim about taste, audience or place. It carries a small number that opens the Qloo finding behind it, and every name and number in it matches that finding.',
  },
  {
    term: 'Playbook line',
    body: 'Launch practice: timing, channels, how to brief a creative. It cites nothing and never claims what an audience likes.',
  },
  {
    term: 'Confidence',
    body: 'High, medium or lower, set by code from how much the line rests on. It says how much the line rests on, not how good the result is.',
  },
  {
    term: 'Receipt',
    body: 'The exact Qloo call behind a line, with the rule that turned it into a verdict.',
  },
];

export function GuideBody() {
  return (
    <div
      className={`${wrap} grid gap-12 py-[clamp(56px,8vw,112px)] min-[1000px]:grid-cols-[220px_minmax(0,1fr)]`}
    >
      <SectionNav sections={sections} />

      <div className="flex min-w-0 flex-col gap-14">
        <Block id="start" title="Start with one message.">
          <p className={prose}>
            Oraqul starts from a message, not a form. Say what you are launching, where and when,
            and what you already have. It reads the category and the job, states what it understood,
            and asks only when it cannot go on without an answer. The better the message, the less
            it has to assume.
          </p>
          <div className="grid gap-3 min-[800px]:grid-cols-3">
            {JOBS.map((j) => (
              <div key={j.title} className="flex flex-col gap-2 rounded-2xl bg-card p-5">
                <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                  {j.title}
                </h3>
                <p className="text-[14.5px] leading-[1.55] text-ink/80">{j.body}</p>
                <p className="mt-auto text-[13px] text-muted">Bring: {j.bring}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block id="builder" title="Build a brief.">
          <p className={prose}>
            Fill in what you know. The brief is written in the forms Oraqul reads without guessing,
            and the list beside it shows what is still missing and why it matters. Leave anything
            out: the plan says what it assumed.
          </p>
          <PromptBuilder />
        </Block>

        <Block id="details" title="What matters most.">
          <p className={prose}>
            In order of how much each one changes the plan. Give the first few and you get most of
            the benefit.
          </p>
          <ol className="flex flex-col gap-2">
            {DETAILS.map((d, i) => (
              <li
                key={d.id}
                className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 rounded-xl bg-card px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  className="grid size-7 place-items-center rounded-lg bg-accent-soft text-[13px] font-semibold text-accent tabular-nums"
                >
                  {i + 1}
                </span>
                <span>
                  <b className="text-[15px]">{d.label}</b>
                  <span className="block text-[14px] text-muted">{d.why}</span>
                </span>
              </li>
            ))}
          </ol>
          <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
            Weak and strong, side by side
          </h3>
          <div className="overflow-hidden rounded-2xl bg-card">
            <table className="w-full border-collapse text-left text-[14.5px]">
              <thead>
                <tr className="border-b border-line text-[13px] text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Detail
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Too loose
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Plans well
                  </th>
                </tr>
              </thead>
              <tbody>
                {WEAK_STRONG.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-0 align-top">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {r.label}
                    </th>
                    <td className="px-4 py-3 text-muted">{r.weak}</td>
                    <td className="px-4 py-3">{r.strong}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={prose}>
            Use real, public names only: titles, artists, brands and cities. Oraqul sends nothing
            personal to Qloo, so leave out people’s details and customer lists.
          </p>
        </Block>

        <Block id="categories" title="By category.">
          <div className="grid gap-3 min-[800px]:grid-cols-2">
            {categories.map((c) => {
              const g = CATEGORY_GUIDE[c];
              const lib = rules[c];
              return (
                <div key={c} data-cat={c} className="flex flex-col gap-2.5 rounded-2xl bg-card p-5">
                  <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                    {g.name}
                  </h3>
                  <p className="text-[14.5px] text-ink/80">
                    <b>Judged on:</b> {lib.signal.value.primary}.
                  </p>
                  <p className="text-[14.5px] text-ink/80">
                    <b>Leads on:</b> {lib.channels.value.join(', ')}.
                  </p>
                  <p className="text-[14.5px] text-ink/80">
                    <b>Also helps:</b> {g.extras.map((x) => x.label.toLowerCase()).join(', ')}.
                  </p>
                </div>
              );
            })}
          </div>
        </Block>

        <Block id="reading" title="Reading a plan.">
          <dl className="grid gap-3 min-[800px]:grid-cols-2">
            {READING.map((r) => (
              <div key={r.term} className="flex flex-col gap-1 rounded-2xl bg-card p-5">
                <dt className="font-display text-[17px] font-semibold tracking-[-0.02em]">
                  {r.term}
                </dt>
                <dd className="text-[14.5px] leading-[1.55] text-ink/80">{r.body}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-5">
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
              Two kinds of call
            </h3>
            <p className="text-[14.5px] text-ink/80">
              A belief in your plan gets a verdict. A decision gets a direction.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictPill verdict="holds" />
              <VerdictPill verdict="weak" />
              <VerdictPill verdict="breaks" />
              <VerdictPill verdict="cant" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DirectionPill direction="okay" />
              <DirectionPill direction="risky" />
              <DirectionPill direction="avoid" />
            </div>
            <p className="text-[14.5px] text-ink/80">
              Directions are set by code from what Qloo returned, for each opening date, territory
              and partner. A direction on something you chose keeps your choice and says how to
              handle it. Neither is a forecast.
            </p>
          </div>
        </Block>

        <Block id="after" title="After the plan.">
          <ul className="flex max-w-[62ch] flex-col gap-2.5 text-[16.5px] leading-[1.6] text-ink/80">
            <li>
              <b>Ask a what-if.</b> “What if we open in Houston first?” reruns the plan with the
              change and marks what moved.
            </li>
            <li>
              <b>Check a rival date.</b> Name a rival and the day it opens. You supplied the date;
              Qloo says how much audience you share.
            </li>
            <li>
              <b>Brief a partner.</b> A draft you review and send yourself. Oraqul never sends.
            </li>
            <li>
              <b>Make the creative kit.</b> “Make the creative kit for Lagos on WhatsApp” gives
              hooks, a script outline, a shot list, a key art brief and a caption pack.
            </li>
            <li>
              <b>Add results.</b> After launch, give totals by city and the next plan is built
              around who showed up.
            </li>
          </ul>
        </Block>

        <Block id="wont" title="What it will not do.">
          <ul className="flex max-w-[62ch] flex-col gap-2.5 text-[16.5px] leading-[1.6] text-ink/80">
            <li>
              No forecasts of sales, streams, downloads or box office. A target is your goal, not a
              prediction.
            </li>
            <li>No pricing advice, and no price for a partner. Price is always unknown.</li>
            <li>
              No ads, trailers, images or video. It writes the script, shot list, key art brief,
              caption pack and hook options, and a person makes the final creative.
            </li>
            <li>No sending. Anything drafted is for you to review and send.</li>
          </ul>
        </Block>

        <Block id="rules" title="The launch rules.">
          <p className={prose}>
            Each category plans by a versioned set of rules. Every rule carries its source and the
            date it was set, and each plan records the version it used.
          </p>
          <div className="grid gap-3">
            {categories.map((c) => {
              const lib = rules[c];
              return (
                <div key={c} data-cat={c} className="flex flex-col gap-2 rounded-2xl bg-card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                      {CATEGORY_GUIDE[c].name}
                    </h3>
                    <span className="font-mono text-[12px] text-muted">{lib.version}</span>
                  </div>
                  {lib.timeline.map((t) => (
                    <p key={t.id} className="text-[14.5px] text-ink/80">
                      {t.value}
                      <span className="block text-[12.5px] text-muted">
                        {t.source.label}, {t.source.date}
                      </span>
                    </p>
                  ))}
                  <p className="text-[14.5px] text-ink/80">
                    Judged on {lib.signal.value.primary.toLowerCase()}.
                    {lib.signal.value.benchmark
                      ? ` A target of ${lib.signal.value.benchmark.value.toLocaleString('en-US')} ${lib.signal.value.benchmark.unit}, with ${lib.signal.value.benchmark.floor?.toLocaleString('en-US')} as the floor.`
                      : ' Set your own target.'}
                    <span className="block text-[12.5px] text-muted">
                      {lib.signal.source.label}, {lib.signal.source.date}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
            Partner tiers
          </h3>
          <div className="grid gap-3 min-[800px]:grid-cols-3">
            {(['A', 'B', 'C'] as const).map((t) => (
              <div key={t} className="flex flex-col gap-1.5 rounded-2xl bg-card p-5">
                <b className="font-display text-[17px] tracking-[-0.02em]">
                  Tier {t}, {TIER_LABEL[t].name}
                </b>
                <span className="text-[14px] text-ink/80">{TIER_LABEL[t].what}</span>
              </div>
            ))}
          </div>
        </Block>
      </div>
    </div>
  );
}
