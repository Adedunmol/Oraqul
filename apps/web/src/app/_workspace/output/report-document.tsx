'use client';

import type {
  AuditReport,
  LaunchLine,
  ReportItem,
  ResultGap,
  ResultsComparison,
  RuleCheck,
  Verdict,
} from '@oraqul/schema';
import { Confidence, ReceiptChip, VerdictPill } from '@oraqul/ui';
import { Mark } from './line';
import { footnotesOf, Groups, LineText } from './plan-document';

// Most urgent first: what breaks, then what is weak, what holds, and what could not be tested.
const ORDER: Verdict[] = ['breaks', 'weak', 'holds', 'cant'];

const GAP_WORD: Record<ResultGap, string> = {
  under: 'Behind the plan',
  over: 'Ahead of the plan',
  'as-planned': 'As planned',
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const place = (n: number | null) =>
  n === null ? 'Not in the plan' : (ORDINALS[n - 1] ?? `${n}th`);

/** Every line of a report that can cite a finding, in reading order, for the footnote numbers. */
export function reportLines(report: AuditReport): LaunchLine[] {
  return [
    ...report.items.flatMap((i) => (i.fix ? [i.fix] : [])),
    ...report.risks,
    ...report.alternatives,
  ];
}

/**
 * The audit report as a document, used in the chat and on the report page: what held, what did
 * not, how the launch compared with the plan, then the risks. What is worth a look is advice, so
 * the chat shows it beneath the card (`ReportLines`). What a line rests on is a quiet number that
 * opens the evidence.
 */
export function ReportDocument({
  report,
  onSource,
}: {
  report: AuditReport;
  onSource: (findingId: string) => void;
}) {
  return (
    <div className="font-read flex flex-col gap-10 text-[16px] leading-[1.72]">
      <ReportItems report={report} onSource={onSource} />
      {report.results ? <ReportResults results={report.results} /> : null}
      <RuleChecks checks={report.ruleChecks} />
      <ReportLines title="Risks" lines={report.risks} report={report} onSource={onSource} />
    </div>
  );
}

// A rule check says whether the plan follows a launch rule. It is not a Qloo verdict, so it has its
// own words and glyphs and no confidence.
const RULE_STATUS: Record<RuleCheck['status'], { glyph: string; word: string; tone: string }> = {
  follows: { glyph: '✓', word: 'Follows the rule', tone: 'text-holds' },
  outside: { glyph: '!', word: 'Outside the rule', tone: 'text-warn' },
  'not-stated': { glyph: '–', word: 'Not stated in the plan', tone: 'text-muted' },
  'no-rule': { glyph: '·', word: 'No rule to check against', tone: 'text-muted' },
};

/** The plan's own dates and shares set beside the launch rules. Renders nothing without any. */
export function RuleChecks({ checks }: { checks: RuleCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <section aria-labelledby="rule-checks" className="flex flex-col gap-3">
      <h2 id="rule-checks" className="font-display text-[20px] font-semibold tracking-[-0.02em]">
        Your plan against the rules
      </h2>
      <p className="text-[13px] text-muted">
        Oraqul reads the dates and shares your plan states and sets them beside the launch rules.
        This says whether the plan follows a rule, not whether it will work.
      </p>
      <ul className="flex flex-col gap-2">
        {checks.map((c) => {
          const s = RULE_STATUS[c.status];
          return (
            <li key={c.id} className="flex flex-col gap-1 rounded-xl bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{c.label}</b>
                <span className={`text-[13px] font-semibold ${s.tone}`}>
                  <span aria-hidden="true">{s.glyph} </span>
                  {s.word}
                </span>
              </div>
              <p className="text-[13px] text-muted">{c.why}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The assumptions, grouped by verdict. `only` shows one group. */
export function ReportItems({
  report,
  only,
  onSource,
}: {
  report: AuditReport;
  only?: Verdict;
  onSource: (findingId: string) => void;
}) {
  const notes = footnotesOf(reportLines(report));
  const groups = ORDER.filter((v) => !only || v === only).flatMap((verdict) => {
    const items = report.items.filter((i) => i.verdict === verdict);
    return items.length ? [{ verdict, items }] : [];
  });
  if (groups.length === 0) return <p className="text-muted">Nothing in this group.</p>;
  return (
    <section className="flex flex-col gap-5">
      {groups.map(({ verdict, items }) => (
        <div key={verdict} className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2.5 font-display text-[20px] font-semibold tracking-[-0.02em]">
            <VerdictPill verdict={verdict} />
            <span className="text-[14px] font-medium text-muted tabular-nums">{items.length}</span>
          </h2>
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <Item item={item} report={report} notes={notes} onSource={onSource} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Item({
  item,
  report,
  notes,
  onSource,
}: {
  item: ReportItem;
  report: AuditReport;
  notes: Map<string, number>;
  onSource: (findingId: string) => void;
}) {
  const row = report.results?.rows.find((r) => item.id === `a-place-${slug(r.place)}`);
  const first = item.findingIds[0];
  return (
    <div className="flex flex-col gap-2 border-t border-line py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15.5px] font-semibold">{item.claim}</h3>
        {item.unstated ? <Mark>Unstated</Mark> : null}
        <span className="ml-auto flex items-center gap-2">
          {item.verdict === 'cant' ? null : <Confidence level={item.confidence} />}
          {first ? <ReceiptChip onClick={() => onSource(first)} aria-label="Open receipt" /> : null}
        </span>
      </div>
      {item.source ? (
        <p className="text-[13px] text-muted">Where the plan says it: {item.source}</p>
      ) : null}
      <p className="text-[13.5px] text-muted">{item.why}</p>
      {row ? (
        <p className="text-[13.5px]">
          <b>Your results:</b> {row.place} finished {place(row.actualRank)}, and the plan put it{' '}
          {place(row.plannedRank)}. {GAP_WORD[row.gap]}.
        </p>
      ) : null}
      {item.fix ? (
        <p className="text-[15px] leading-[1.6]">
          <b>What to do:</b>{' '}
          <LineText line={item.fix} notes={notes} sources={report.sources} onSource={onSource} />
        </p>
      ) : null}
    </div>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

/** A list of the report's own lines, such as its risks, as plain bullets with footnotes. */
export function ReportLines({
  title,
  lines,
  report,
  onSource,
  quiet = false,
}: {
  title: string;
  lines: LaunchLine[];
  report: AuditReport;
  onSource: (findingId: string) => void;
  /** Advice beneath a card rather than a section of the document: a smaller title. */
  quiet?: boolean;
}) {
  if (lines.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2
        className={`font-display font-semibold tracking-[-0.02em] ${quiet ? 'text-[16px]' : 'text-[20px]'}`}
      >
        {title}
      </h2>
      <Groups
        lines={lines.map((l) =>
          l.group?.toLowerCase() === title.toLowerCase() ? { ...l, group: null } : l,
        )}
        notes={footnotesOf(reportLines(report))}
        sources={report.sources}
        onSource={onSource}
      />
    </section>
  );
}

/** How the launch did, city by city, against where the plan put each one. */
export function ReportResults({ results }: { results: ResultsComparison }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Your results</h2>
      <p className="text-[13px] text-muted">
        Each city’s share of the total {results.measure}
        {results.asOf ? `, ${results.asOf}` : ''}, in the order the cities finished.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-left text-[14px]">
          <caption className="sr-only">Results by city against the plan</caption>
          <thead>
            <tr className="text-[12px] text-muted">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                City
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                Share
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Plan put it
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                It finished
              </th>
              <th scope="col" className="py-1.5 font-semibold">
                Against the plan
              </th>
            </tr>
          </thead>
          <tbody>
            {results.rows.map((r) => (
              <tr key={r.place} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 font-semibold">
                  {r.place}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{r.actualShare}%</td>
                <td className="py-2 pr-3">{place(r.plannedRank)}</td>
                <td className="py-2 pr-3">{place(r.actualRank)}</td>
                <td className="py-2">{GAP_WORD[r.gap]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.ages ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left text-[14px]">
            <caption className="sr-only">Results by age group</caption>
            <thead>
              <tr className="text-[12px] text-muted">
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Age group
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {results.ages.map((a) => (
                <tr key={a.band} className="border-t border-line">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {a.band}
                  </th>
                  <td className="py-2 text-right tabular-nums">{a.actualShare}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
