import type { Verdict } from '@oraqul/schema';
import { Confidence, DirectionPill, VerdictPill } from '@oraqul/ui';
import type { ReactNode } from 'react';
import { liftZones, Scale } from '../scale';
import { wrap } from '../section';
import { SectionNav } from '../section-nav';

export function FormulaCard() {
  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-card p-[clamp(20px,3vw,32px)]">
      <p className="font-mono text-[13px] text-muted">How a lift is computed</p>
      <p className="font-display text-[clamp(24px,3vw,36px)] leading-[1.2] font-semibold tracking-[-0.03em]">
        lift = <span className="text-accent">score(x)</span> ÷{' '}
        <span className="text-muted">score(baseline)</span>
      </p>
      <p className="text-[15px] leading-[1.55] text-ink/75">
        Both scores come from the same Qloo ranking call: your audience in a place, against a
        neutral audience in the same place. Above 1 means your audience likes it more than most.
      </p>
    </div>
  );
}

export const sections = [
  { id: 'who', title: 'Who sets the numbers' },
  { id: 'verdicts', title: 'Verdicts' },
  { id: 'lift', title: 'Lift' },
  { id: 'fit', title: 'Fit' },
  { id: 'overlap', title: 'Rival overlap' },
  { id: 'direction', title: 'Direction calls' },
  { id: 'rules', title: 'Launch rules' },
  { id: 'more', title: 'Route and topics' },
  { id: 'confidence', title: 'Confidence' },
  { id: 'held', title: 'Held back' },
  { id: 'measures', title: 'What it measures' },
] as const;

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

const prose = 'max-w-[62ch] text-[17px] leading-[1.65] text-ink/80';

const verdictRules: { verdict: Verdict; rule: string }[] = [
  { verdict: 'holds', rule: 'The values Qloo returned support the belief by its rule.' },
  { verdict: 'weak', rule: 'There is support, but below the rule’s strong threshold.' },
  {
    verdict: 'breaks',
    rule: 'The values point the other way, or another option ranks clearly above it.',
  },
  {
    verdict: 'cant',
    rule: 'Qloo returned no signal. It is never counted as Weak, and nothing is guessed.',
  },
];

export function MethodBody() {
  return (
    <div
      className={`${wrap} grid gap-12 py-[clamp(56px,8vw,112px)] min-[1000px]:grid-cols-[220px_minmax(0,1fr)]`}
    >
      <SectionNav sections={sections} />

      <div className="flex flex-col gap-14">
        <Block id="who" title="Code sets every number. The model writes the words.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl bg-ink p-6 text-bg">
              <p className="font-display text-[20px] font-semibold">Code</p>
              <ul className="flex flex-col gap-2 text-[15px] opacity-90">
                <li>Every score, lift and fit</li>
                <li>Every verdict and its rule</li>
                <li>Confidence for each line</li>
                <li>Rankings of places and dates</li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl bg-card p-6">
              <p className="font-display text-[20px] font-semibold">The model</p>
              <ul className="flex flex-col gap-2 text-[15px] text-ink/80">
                <li>Reads what you wrote</li>
                <li>Chooses which questions to ask Qloo</li>
                <li>Explains the results in plain words</li>
                <li>Drafts the plan around them</li>
              </ul>
            </div>
          </div>
          <p className={prose}>
            Numbers come only from values Qloo returned in the same run. If the model names a title
            or place that is not in that run’s Qloo data, the output is rejected and the step runs
            again.
          </p>
        </Block>

        <Block id="verdicts" title="Verdicts">
          <p className={prose}>
            Each belief in a plan gets one of four verdicts, always shown as a glyph and a word. The
            exact rule used is written in that belief’s receipt.
          </p>
          <ul className="overflow-hidden rounded-2xl bg-card">
            {verdictRules.map((v) => (
              <li
                key={v.verdict}
                className="grid items-center gap-3 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[150px_1fr]"
              >
                <span>
                  <VerdictPill verdict={v.verdict} />
                </span>
                <span className="text-[15.5px]">{v.rule}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="lift" title="Lift">
          <p className={prose}>
            How much more your audience likes something than a neutral audience in the same place,
            from one ranking call. Strong at 1.5 and above, usable from 1.2 to 1.5, weak below 1.2.
          </p>
          <div className="rounded-2xl bg-card p-[clamp(18px,3vw,28px)]">
            <Scale min={0.6} max={2.2} zones={liftZones} value={1.62} />
          </div>
        </Block>

        <Block id="fit" title="Fit">
          <p className={prose}>
            A score from 0 to 100 for a partner Qloo scored against mass-market names in one call.
            75 and above is recommended, 50 to 74 is usable, and below 50 is not recommended.
          </p>
          <div className="rounded-2xl bg-card p-[clamp(18px,3vw,28px)]">
            <Scale
              min={0}
              max={100}
              value={81}
              format={(v) => String(Math.round(v))}
              zones={[
                { to: 50, label: 'Not recommended below 50', fill: 'bg-weak-bg' },
                { to: 75, label: 'Usable 50 to 74', fill: 'bg-surface2' },
                { to: 100, label: 'Recommended 75+', fill: 'bg-holds-bg' },
              ]}
            />
          </div>
        </Block>

        <Block id="overlap" title="Rival overlap">
          <p className={prose}>
            The shared audience between your title and a rival, from one scoring call. Lower is
            better: below 70 is low, 70 to 85 is moderate, and above 85 is high overlap.
          </p>
          <div className="rounded-2xl bg-card p-[clamp(18px,3vw,28px)]">
            <Scale
              min={0}
              max={100}
              value={28}
              format={(v) => String(Math.round(v))}
              zones={[
                { to: 70, label: 'Low below 70', fill: 'bg-holds-bg' },
                { to: 85, label: 'Moderate 70 to 85', fill: 'bg-surface2' },
                { to: 100, label: 'Risky above 85', fill: 'bg-breaks-bg' },
              ]}
            />
          </div>
        </Block>

        <Block id="direction" title="Direction calls">
          <p className={prose}>
            A verdict tests a belief. A direction says what to do about a decision: an opening date
            against its rivals, a territory as a place to open, a partner among the brands Qloo
            ranked. Code sets it from a value Qloo returned, with the confidence of the finding
            behind it.
          </p>
          <ul className="overflow-hidden rounded-2xl bg-card">
            {(
              [
                ['okay', 'Overlap below 70, a place at 1.2 or above, a partner in the top third.'],
                [
                  'risky',
                  'Overlap 70 to 85, a place from 1.0 to 1.2, a partner in the middle third.',
                ],
                [
                  'avoid',
                  'Overlap above 85 (high overlap), a place below 1.0, a partner in the bottom third. For a live show, a rival on the same night or week is at least risky.',
                ],
              ] as const
            ).map(([direction, rule]) => (
              <li
                key={direction}
                className="grid items-center gap-3 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[150px_1fr]"
              >
                <span>
                  <DirectionPill direction={direction} />
                </span>
                <span className="text-[15.5px]">{rule}</span>
              </li>
            ))}
          </ul>
          <p className={prose}>
            A call on something you chose keeps your choice. An avoid on your own city says to open
            it after the stronger ones, and never to drop it. Something Qloo did not rank gets no
            call.
          </p>
        </Block>

        <Block id="rules" title="Launch rules">
          <p className={prose}>
            The craft around the data is written down per category and versioned: how a calendar is
            worked back from the release date, the one signal a plan is judged on, the channels that
            lead, and the partner tiers. Each rule carries its source and the date it was set, and
            each plan records the version it used. A target is the goal you set, or a benchmark of
            Oraqul's own where there is one, and it is never a forecast. The rules are on the{' '}
            <a href="/guide#rules" className="text-accent underline">
              guide
            </a>
            .
          </p>
        </Block>

        <Block id="more" title="Route and topics">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-2xl bg-card p-6" data-cat="music">
              <p className="font-display text-[18px] font-semibold">Route score, for tours</p>
              <p className="text-[15px] leading-[1.6] text-ink/80">
                A weighted mean of lift over the stops, weighted 1, 0.9, 0.8 and so on by position,
                so the first cities count most. The best order by lift is shown beside it for
                comparison.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-card p-6" data-cat="podcasts">
              <p className="font-display text-[18px] font-semibold">
                Topic ownership, for podcasts
              </p>
              <p className="text-[15px] leading-[1.6] text-ink/80">
                One comparison of your audience with the rival shows’ audiences. A topic only your
                side lists is yours; one on both sides is shared. The weight orders and sizes the
                topics and never decides who owns one.
              </p>
            </div>
          </div>
        </Block>

        <Block id="confidence" title="Confidence">
          <div className="flex flex-wrap gap-2">
            <Confidence level="high" />
            <Confidence level="medium" />
            <Confidence level="lower" />
          </div>
          <p className={prose}>
            Set for each line from what stands behind it: how many comparable titles, people and
            themes Oraqul could use, how well Qloo knows each, and whether they agree. A launch that
            is not in Qloo yet is the normal case and does not lower confidence by itself. Few or
            poorly known comparisons do. It is a word, never a percentage, because a percentage
            would claim a precision the data does not have.
          </p>
        </Block>

        <Block id="held" title="Held back">
          <p className={prose}>
            Some signals stay out of the bottom line until they are validated: the values signal and
            the early adopter score and premium tolerance. None of them is used in a plan today, and
            nothing here is ever a price.
          </p>
        </Block>

        <Block id="measures" title="What it measures">
          <p className={prose}>
            Oraqul measures audience taste: who likes what, and where. Sales, streams, ticket
            numbers and prices are yours to bring, and Oraqul compares them with the plan when you
            do. It drafts briefs and next steps for you to send; it never sends anything itself.
          </p>
        </Block>
      </div>
    </div>
  );
}
