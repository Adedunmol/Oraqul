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
  { id: 'difference', title: 'What the taste data changes' },
  { id: 'verdicts', title: 'Verdicts' },
  { id: 'lift', title: 'Lift' },
  { id: 'fit', title: 'Fit' },
  { id: 'overlap', title: 'Rival overlap' },
  { id: 'direction', title: 'Direction calls' },
  { id: 'opportunities', title: 'Opportunities' },
  { id: 'results', title: 'Your results' },
  { id: 'changed', title: 'What changed' },
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
        <Block id="who" title="Measured, sourced, computed, written.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                'Measured',
                'Taste and place come from Qloo: who the audience is, what they like and where they gather, ranked for each city.',
              ],
              [
                'Sourced',
                'Dated market facts, such as rivals, release windows and distributors, come from web research and link to their page.',
              ],
              [
                'Computed',
                'Code works out every score, verdict, ranking and confidence, and checks every line of the plan against them.',
              ],
              [
                'Written',
                'The model reads your brief, chooses which questions to ask, and writes the plan. Launch craft is labelled and cites nothing.',
              ],
            ].map(([title, text]) => (
              <div key={title} className="flex flex-col gap-2 rounded-2xl bg-card p-6">
                <p className="font-display text-[20px] font-semibold">{title}</p>
                <p className="text-[15px] leading-[1.6] text-ink/80">{text}</p>
              </div>
            ))}
          </div>
          <p className={prose}>
            Numbers come only from values Qloo returned in the same run. If the model names a title
            or place that is not in that run’s Qloo data, the output is rejected and the step runs
            again. A fact with no page behind it is not stated.
          </p>
        </Block>

        <Block id="difference" title="The taste data changes the decision, not just the wording.">
          <p className={prose}>
            Qloo is part of the planning loop. Oraqul uses its audience taste data to test the
            brief, rank real options and decide which recommendations can be stated. The model
            cannot add a taste claim after the fact or set the result itself.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                'Tests the brief',
                'Audience, market and partner assumptions receive a verdict from published rules.',
              ],
              [
                'Changes the order',
                'Places, dates and partners are ranked from the returned data before the plan is written.',
              ],
              [
                'Leaves a receipt',
                'Every grounded recommendation links back to the finding and Qloo call behind it.',
              ],
            ].map(([title, text]) => (
              <div key={title} className="flex flex-col gap-2 rounded-2xl bg-card p-5">
                <h3 className="font-display text-[17px] font-semibold">{title}</h3>
                <p className="text-[14.5px] leading-[1.6] text-ink/75">{text}</p>
              </div>
            ))}
          </div>
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

        <Block id="opportunities" title="Opportunities">
          <p className={prose}>
            A nearby city is shown under Worth a look only when it ranks above your weakest city in
            the same Qloo call, and an area only when a city’s neighbourhood reading ranks it
            strongest. Each comes with why it fits, which cites its finding, and three lines of
            launch craft that claim nothing about taste: what the data does not show, a first test
            and what to measure. Code writes all four, asks Qloo nothing more, and never changes
            your plan: an opportunity is a lead beside it until you add it. If the evidence is thin
            there are none, and the page does not fill a list. Qloo shows who likes what, not that a
            market will sell.
          </p>
        </Block>

        <Block id="results" title="Your results">
          <p className={prose}>
            Results are your own evidence, kept apart from Qloo’s findings and from web facts. You
            say the period they cover and where they came from, and Oraqul keeps each only when your
            own words contain it. Code works out each place’s share of the total and sets it against
            the place the plan gave it. For a campaign test, code compares your figures for the two
            angles: fewer than 30 of what you counted for either, or figures within 20% of each
            other, are inconclusive, and otherwise it says which angle recorded more and by how
            much. Those two thresholds are chosen conventions, not a significance test. Results show
            what happened. A line about them never states a cause as fact, and a taste score never
            stands in for a result.
          </p>
        </Block>

        <Block id="changed" title="What changed">
          <p className={prose}>
            When you ask, Oraqul asks Qloo and the web again with your plan’s own brief and sets the
            answers beside what the plan saved. A finding the plan had is moved when a number
            differs by 10% or a name changes place, and otherwise unchanged. A page is changed only
            when the plan saved a fact from the same page and it now says something different, and
            each fresh fact carries the day it was read. A finding or page it does not return is not
            a change, because the check asks the brief again and does not replay the exact calls.
            Your plan stays as it is until you ask for a revision.
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
