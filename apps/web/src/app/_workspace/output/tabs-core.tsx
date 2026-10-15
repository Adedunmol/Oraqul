'use client';

import type { Verdict } from '@oraqul/schema';
import { Button, ChipButton, Confidence, Kbd, ReceiptChip, VerdictPill } from '@oraqul/ui';
import Link from 'next/link';
import { useState } from 'react';
import {
  ChartCard,
  DataTable,
  GroupedColumns,
  HBars,
  toneClass,
  VerdictBar,
  verdictTable,
  verdictTone,
} from '../charts';
import { copyText } from '../toast';
import { useOutputView } from './context';
import { Evidence, FitBar, Line, Mark, Num, Section, Stack, TabTitle } from './line';

const NEXT_STEP: Record<Verdict, string> = {
  holds: 'Safe to rely on. No action needed.',
  weak: 'Not safe to rely on yet. Test it before you commit spend.',
  breaks: 'This is wrong. Change the plan.',
  cant: 'Qloo has no data for this. Decide it yourself or add your own numbers.',
};

export function Stats() {
  const { output } = useOutputView();
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-2">
      {output.stats.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5 text-[13px] text-muted">
          {s.verdict ? (
            <i
              aria-hidden="true"
              className={`size-2.5 rounded-[3px] ${toneClass[verdictTone[s.verdict]]}`}
            />
          ) : null}
          {s.label} <b className="text-ink tabular-nums">{s.value}</b>
        </span>
      ))}
    </div>
  );
}

function SummaryCard() {
  const { output, receipt, openReceipt, goToTab, openExport } = useOutputView();
  const partner =
    output.kind === 'partner'
      ? output.brief.partners.find((p) => p.id === output.focusIds[0])
      : undefined;
  return (
    <section className="grid grid-cols-1 items-start gap-4 rounded-2xl bg-card p-[clamp(20px,2.6vw,30px)] min-[900px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[900px]:gap-[clamp(20px,3vw,44px)]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="max-w-[30ch] font-display text-[clamp(23px,2.3vw,28px)] font-semibold leading-[1.18] tracking-[-0.025em]">
          {output.headline}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Confidence level={output.confidence.level} />
          <span className="text-muted">{output.confidence.why}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="small"
            icon="copy"
            onClick={() => copyText(output.summary, 'Summary copied')}
          >
            Copy summary
          </Button>
          <Button size="small" icon="export" className="max-[899px]:hidden" onClick={openExport}>
            Export brief
          </Button>
          {partner ? (
            <Button
              size="small"
              icon="copy"
              onClick={() => copyText(partner.draft, 'Draft copied')}
            >
              Copy draft
            </Button>
          ) : null}
          <Button size="small" variant="ghost" onClick={() => goToTab('evidence')}>
            See the evidence
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[12px] font-semibold text-muted">Do this</p>
        <ol className="flex flex-col gap-2">
          {output.moves.map((m, i) => (
            <li
              key={m.text}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 min-[640px]:grid-cols-[auto_minmax(0,1fr)_auto] rounded-xl bg-surface2 px-3.5 py-[11px]"
            >
              <Kbd>{i + 1}</Kbd>
              <span>{m.text}</span>
              {m.lineId && receipt(m.lineId) ? (
                <ReceiptChip
                  className="col-start-2 justify-self-start min-[640px]:col-start-auto"
                  onClick={() => m.lineId && openReceipt(m.lineId)}
                  aria-label="Open receipt"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AtAGlance() {
  const { output } = useOutputView();
  if (!output.glance.length) return null;
  return (
    <Section title="At a glance">
      <Stack>
        {output.glance.map((g) => (
          <Line
            key={g.label}
            title={`${g.label}: ${g.name}`}
            side={
              <>
                <Num>{g.value}</Num>
                <Evidence lineId={g.lineId} />
              </>
            }
          >
            {g.note ? <p>{g.note}</p> : null}
          </Line>
        ))}
      </Stack>
    </Section>
  );
}

export function SummaryTab() {
  const { output, goToTab } = useOutputView();
  const b = output.brief;
  return (
    <>
      <SummaryCard />
      <Stats />
      {output.kind === 'build' || output.kind === 'audit' ? (
        <>
          <ChartCard title="How the assumptions tested" table={verdictTable(output.counts)}>
            <VerdictBar counts={output.counts} />
          </ChartCard>
          <AtAGlance />
        </>
      ) : null}
      {output.kind === 'scenario' ? (
        <>
          <ChartCard
            title="How the assumptions tested after this change"
            table={verdictTable(output.counts)}
          >
            <VerdictBar counts={output.counts} />
          </ChartCard>
          <Section title="Biggest changes">
            <Stack>
              {output.changes.slice(0, 5).map((c) => (
                <Line key={c.lineId} title={c.label}>
                  <p>Was: {c.before ?? 'Not in the earlier plan'}</p>
                  <p className="text-ink">
                    <b>Now:</b> {c.after ?? 'Removed'}
                  </p>
                </Line>
              ))}
            </Stack>
            <div>
              <Button size="small" onClick={() => goToTab('changes')}>
                See all {output.changes.length} changes
              </Button>
            </div>
          </Section>
        </>
      ) : null}
      {output.kind === 'rescue' && b.results && output.resultsCopy ? (
        <ChartCard
          title={output.resultsCopy.chartTitle}
          note={output.resultsCopy.chartNote}
          table={plannedTable(
            output.resultsCopy.groupNoun,
            b.groupLabels,
            b.planned,
            b.results.actual,
          )}
        >
          <GroupedColumns
            labels={b.groupLabels}
            a={b.planned}
            b={b.results.actual}
            nameA="Planned"
            nameB="Actual"
          />
        </ChartCard>
      ) : null}
      {output.kind === 'date' ? <DateTab /> : null}
      {output.kind === 'partner' ? <PartnerDraft /> : null}
    </>
  );
}

function PartnerDraft() {
  const { output } = useOutputView();
  const p = output.brief.partners.find((x) => x.id === output.focusIds[0]);
  if (!p) return null;
  return (
    <Section title="Draft">
      <Draft text={p.draft} />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="small" icon="copy" onClick={() => copyText(p.draft, 'Draft copied')}>
          Copy draft
        </Button>
        <span className="text-xs text-muted">Oraqul never sends this.</span>
      </div>
    </Section>
  );
}

function Draft({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap rounded-lg bg-surface2 p-3 text-[13px]">{text}</div>;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function plannedTable(noun: string, labels: string[], planned: number[], actual: number[]) {
  return {
    head: [capitalise(noun), 'Planned', 'Actual'],
    rows: labels.map((l, i) => [l, `${planned[i] ?? 0}%`, `${actual[i] ?? 0}%`]),
  };
}

export function AudienceTab() {
  const { output } = useOutputView();
  const rows = output.brief.audience;
  return (
    <>
      <TabTitle
        title="Audience"
        note="Affinity is an index from 0 to 100 built from taste overlap with the comps. It is not a share of buyers."
      />
      <ChartCard
        title="Affinity by segment"
        note="Higher means the segment overlaps more with your comps."
        table={{
          head: ['Segment', 'Affinity', 'Evidence'],
          rows: rows.map((a) => [a.name, a.affinity, a.evidence]),
        }}
      >
        <HBars
          items={rows.map((a) => ({
            label: a.name,
            value: String(a.affinity),
            width: a.affinity,
            tip: `${a.name}: ${a.affinity}. ${a.evidence}`,
          }))}
        />
      </ChartCard>
      <Stack>
        {rows.map((a) => (
          <Line
            key={a.id}
            lineId={a.id}
            title={a.name}
            side={
              <>
                <Num>{a.affinity}</Num>
                <Evidence lineId={a.id} />
              </>
            }
          >
            <p>{a.evidence}</p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

type Filter = Verdict | 'all';

export function AssumptionsTab() {
  const { output, receipt } = useOutputView();
  const [filter, setFilter] = useState<Filter>('all');
  const list = output.brief.assumptions.filter((a) => filter === 'all' || a.verdict === filter);
  const filters: [Filter, string][] = [
    ['all', 'All'],
    ['holds', 'Holds'],
    ['weak', 'Weak'],
    ['breaks', 'Breaks'],
    ['cant', 'Could not test'],
  ];
  return (
    <>
      <TabTitle title="Assumptions" note="Stated and unstated. Each has a verdict and a receipt." />
      <ChartCard title="Verdicts" table={verdictTable(output.counts)}>
        <VerdictBar counts={output.counts} />
      </ChartCard>
      <div className="flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <ChipButton key={key} selected={filter === key} onClick={() => setFilter(key)}>
            {label}
            {key === 'all' ? '' : ` ${output.counts[key]}`}
          </ChipButton>
        ))}
      </div>
      <Stack>
        {list.length ? (
          list.map((a) => (
            <Line
              key={a.id}
              lineId={a.id}
              title={a.text}
              tags={
                <>
                  {a.source ? <Mark>{a.source}</Mark> : null}
                  {a.unstated ? <Mark>Unstated</Mark> : null}
                </>
              }
              side={
                <>
                  <VerdictPill verdict={a.verdict} />
                  {receipt(a.id) ? (
                    <Evidence lineId={a.id} />
                  ) : (
                    <span className="font-mono text-[11px] text-muted">No receipt</span>
                  )}
                </>
              }
            >
              <p>{a.why}</p>
              <p className="text-ink">
                <b>Next step:</b> {a.fix || NEXT_STEP[a.verdict]}
              </p>
            </Line>
          ))
        ) : (
          <p className="text-muted">Nothing in this group.</p>
        )}
      </Stack>
      {output.brief.cannot.length ? <CannotList /> : null}
    </>
  );
}

export function PlanTab() {
  const { output } = useOutputView();
  return (
    <>
      <TabTitle title="Plan" note="Ranked by fit, 0 to 100. 75 and above is recommended." />
      {output.sections.map((s) => (
        <Section key={s.key} title={s.title}>
          <Stack>
            {output.brief[s.key]
              .slice()
              .sort((a, b) => b.fit - a.fit)
              .map((x) => (
                <FitRow key={x.id} line={x} />
              ))}
          </Stack>
        </Section>
      ))}
      {output.brief.risks.length ? <RiskList /> : null}
    </>
  );
}

export function FitRow({
  line,
}: {
  line: { id: string; name: string; fit: number; evidence: string; note?: string; medium?: string };
}) {
  return (
    <Line
      lineId={line.id}
      title={line.name}
      tags={line.medium ? <Mark>{line.medium}</Mark> : null}
      side={
        <>
          <FitBar value={line.fit} />
          <Num>{line.fit}</Num>
          <Evidence lineId={line.id} />
        </>
      }
    >
      <p>{line.evidence}</p>
      {line.note ? <p className="text-weak">{line.note}</p> : null}
    </Line>
  );
}

function RiskList() {
  const { output } = useOutputView();
  return (
    <Section title="Risks">
      <p className="text-[13px] text-muted">
        Each risk has an early warning signal to watch before it goes out.
      </p>
      <Stack>
        {output.brief.risks.map((k) => (
          <Line key={k.id} lineId={k.id} title={k.text}>
            <p>
              <b>Watch for:</b> {k.signal}
            </p>
            <p>
              <b>Then:</b> {k.action}
            </p>
          </Line>
        ))}
      </Stack>
    </Section>
  );
}

function CannotList() {
  const { output } = useOutputView();
  return (
    <Section title="Could not test">
      <p className="text-[13px] text-muted">
        What Oraqul could not test, and why. Nothing here is guessed. You may need to supply it.
      </p>
      <Stack>
        {output.brief.cannot.map((k) => (
          <Line key={k.id} title={k.item} side={<VerdictPill verdict="cant" />}>
            <p>{k.reason}</p>
          </Line>
        ))}
      </Stack>
    </Section>
  );
}

export function ChangesTab() {
  const { output, receipt } = useOutputView();
  return (
    <>
      <TabTitle
        title="What changed"
        note="Every line this output changed, with what it was before."
      />
      <Stack>
        {output.changes.length ? (
          output.changes.map((c) => (
            <div
              key={c.lineId}
              className="grid grid-cols-1 items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3.5 min-[900px]:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-semibold">{c.label}</h4>
                <p className="text-[13px] text-muted">
                  Was: {c.before ?? 'Not in the earlier plan'}
                </p>
                <p className="text-[13px]">
                  <b>Now:</b> {c.after ?? 'Removed'}
                </p>
              </div>
              {receipt(c.lineId) ? (
                <div className="flex gap-2">
                  <Evidence lineId={c.lineId} confidence={false} />
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-card p-7 text-center text-muted">Nothing changed.</p>
        )}
      </Stack>
    </>
  );
}

export function PartnersTab() {
  const { output } = useOutputView();
  const focus = new Set(output.focusIds);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const list = output.brief.partners
    .slice()
    .sort((a, b) => Number(focus.has(b.id)) - Number(focus.has(a.id)));
  const label = output.tabs.find((t) => t.key === 'partners')?.label ?? 'Partner briefs';
  return (
    <>
      <TabTitle title={label} note="Drafts only. Oraqul never sends or books anything." />
      <Stack>
        {list.map((p) => {
          const shown = open[p.id] ?? focus.has(p.id);
          return (
            <div key={p.id} className="flex flex-col gap-2.5 rounded-xl bg-card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">
                    {p.name}
                    <Mark>{p.type}</Mark>
                    {focus.has(p.id) ? <Mark>This output</Mark> : null}
                  </h4>
                  <p className="text-[13px] text-muted">
                    Fits: {p.fits}. {p.evidence}.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Evidence lineId={p.id} />
                  <Button size="small" onClick={() => setOpen((o) => ({ ...o, [p.id]: !shown }))}>
                    {shown ? 'Hide draft' : 'View draft'}
                  </Button>
                </div>
              </div>
              {shown ? (
                <>
                  <Draft text={p.draft} />
                  <div>
                    <Button
                      size="small"
                      icon="copy"
                      onClick={() => copyText(p.draft, 'Draft copied')}
                    >
                      Copy draft
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </Stack>
    </>
  );
}

const overlapClass = {
  low: 'bg-holds-bg text-holds',
  moderate: 'bg-weak-bg text-weak',
  high: 'bg-breaks-bg text-breaks',
} as const;

export function DateTab() {
  const { output } = useOutputView();
  const b = output.brief;
  const label = output.tabs.find((t) => t.key === 'date')?.label ?? 'Rival date check';
  const you = b.dates.find((d) => d.date === b.chosenDate);
  const table = {
    head: ['Date', 'Rival', 'Shared audience', 'Advice'],
    rows: b.dates.map((d) => [d.date, d.rival, d.overlap, d.advice]),
  };
  const cols = `150px repeat(${b.weeks.length}, minmax(64px, 1fr))`;
  return (
    <>
      <TabTitle
        title={label}
        note="Dates come from you or a public calendar. Qloo supplies how much each rival shares your audience."
      />
      <ChartCard
        title="Rival calendar"
        note="Each row is a date you could pick. The block shows the rival that lands on it and the audience they share with you."
        table={table}
      >
        <div className="overflow-x-auto">
          <div
            role="img"
            aria-label="Rival calendar"
            className="grid min-w-[480px] items-center gap-x-1 gap-y-1.5 text-xs"
            style={{ gridTemplateColumns: cols }}
          >
            <span />
            {b.weeks.map((w) => (
              <span key={w} className="text-center font-mono text-[11px] text-muted">
                {w}
              </span>
            ))}
            <b>Your launch</b>
            {b.weeks.map((w, i) =>
              you && i === you.week ? (
                <span
                  key={w}
                  className="rounded-md bg-accent px-1.5 py-1.5 text-center font-semibold text-accent-ink"
                >
                  {b.chosenDate}
                </span>
              ) : (
                <span key={w} />
              ),
            )}
            {b.dates.map((d) => (
              <DateRow key={d.id} weeks={b.weeks} date={d} />
            ))}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-3.5 text-[13px]">
          <span className="rounded-md bg-holds-bg px-2 text-holds">✓ Low overlap, under 35</span>
          <span className="rounded-md bg-weak-bg px-2 text-weak">◐ Moderate, 35 to 60</span>
          <span className="rounded-md bg-breaks-bg px-2 text-breaks">✕ High, above 60</span>
        </div>
      </ChartCard>
      <ChartCard
        title="Shared audience with each rival"
        note="Above 60 is risky, 35 to 60 moderate, below 35 low."
        table={table}
      >
        <HBars
          items={b.dates.map((d) => ({
            label: `${d.date} vs ${d.rival}${b.chosenDate === d.date ? ' (chosen)' : ''}`,
            value: String(d.overlap),
            width: d.overlap,
            tip: `${d.date} vs ${d.rival}: shared audience ${d.overlap}`,
          }))}
        />
      </ChartCard>
      <Stack>
        {b.dates.map((d) => (
          <Line
            key={d.id}
            lineId={d.id}
            title={`${d.date} vs ${d.rival}`}
            tags={b.chosenDate === d.date ? <Mark>Chosen</Mark> : null}
            side={<Evidence lineId={d.id} />}
          >
            <p>
              Shared audience {d.overlap}. {d.advice}.
            </p>
          </Line>
        ))}
      </Stack>
    </>
  );
}

function DateRow({
  weeks,
  date,
}: {
  weeks: string[];
  date: {
    date: string;
    week: number;
    rival: string;
    overlap: number;
    band: keyof typeof overlapClass;
  };
}) {
  const short = date.rival.split(' (')[0]?.split(',')[0] ?? date.rival;
  return (
    <>
      <span className="font-semibold">If you go {date.date}</span>
      {weeks.map((w, i) =>
        i === date.week ? (
          <span
            key={w}
            data-tip={`${date.rival}, shared audience ${date.overlap}`}
            className={`rounded-md px-1.5 py-1.5 text-center font-semibold ${overlapClass[date.band]}`}
          >
            {short} {date.overlap}
          </span>
        ) : (
          <span key={w} />
        ),
      )}
    </>
  );
}

export function ResultsTab() {
  const { output } = useOutputView();
  const b = output.brief;
  const copy = output.resultsCopy;
  if (!b.results || !copy) {
    return (
      <>
        <TabTitle
          title="Results"
          note="Add your numbers and Oraqul compares who showed up with who the plan assumed."
        />
        <p className="rounded-xl bg-card p-7 text-center text-muted">No results added yet.</p>
      </>
    );
  }
  const r = b.results;
  return (
    <>
      <TabTitle
        title="Results"
        note={`Who showed up compared with who the plan assumed. ${copy.dateLabel}: ${r.date}.`}
      />
      <ChartCard
        title={copy.chartTitle}
        note={copy.chartNote}
        table={plannedTable(copy.groupNoun, b.groupLabels, b.planned, r.actual)}
      >
        <GroupedColumns
          labels={b.groupLabels}
          a={b.planned}
          b={r.actual}
          nameA="Planned"
          nameB="Actual"
        />
      </ChartCard>
      {r.secondary ? (
        <ChartCard
          title={copy.secondaryTitle}
          note="Percent, from your report."
          table={{
            head: ['Group', 'Share'],
            rows: r.secondary.map((g) => [g.label, `${g.share}%`]),
          }}
        >
          <HBars
            items={r.secondary.map((g) => ({
              label: g.label,
              value: String(g.share),
              width: g.share,
            }))}
          />
        </ChartCard>
      ) : null}
      {r.hold ? (
        <div className="flex flex-col rounded-2xl bg-card px-[18px] py-3.5">
          <span className="text-[13px] text-muted">{copy.holdShort}, from your report</span>
          <b className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{r.hold}%</b>
          <span className="text-[13px] text-muted">{copy.holdNote}</span>
        </div>
      ) : null}
      {b.course ? (
        <>
          <Section title="What happened">
            <div className="rounded-xl bg-card px-4 py-3">{b.course.summary}</div>
          </Section>
          <TextList title="Next steps" items={b.course.actions} />
          <TextList title={copy.placesTitle} items={b.course.places} />
          <TextList title="Stop doing" items={b.course.stop} />
        </>
      ) : null}
    </>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      <Stack>
        {items.map((t) => (
          <div key={t} className="rounded-xl bg-card px-4 py-3">
            {t}
          </div>
        ))}
      </Stack>
    </Section>
  );
}

export function EvidenceTab() {
  const { output, receipt, builtOn } = useOutputView();
  const rows = output.evidence;
  const drivers = rows
    .filter((r) => r.driver)
    .sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict));
  const rest = rows.filter((r) => !r.driver);
  const groups = new Map<string, typeof rest>();
  for (const r of rest) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const byEndpoint = new Map<string, number>();
  for (const r of rows) {
    const ep = receipt(r.lineId)?.endpoint ?? 'unknown';
    byEndpoint.set(ep, (byEndpoint.get(ep) ?? 0) + 1);
  }
  const max = Math.max(1, ...byEndpoint.values());
  const listText = rows
    .map(
      (r) =>
        `${receipt(r.lineId)?.callId ?? ''}  ${r.label}  (${receipt(r.lineId)?.endpoint ?? ''})`,
    )
    .join('\n');
  return (
    <>
      <TabTitle
        title="Evidence"
        note="Every Qloo call behind this output. The lines that drove the recommendations come first."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button icon="copy" onClick={() => copyText(listText, 'Evidence list copied')}>
          Copy evidence list
        </Button>
        <span className="text-xs text-muted">
          {rows.length} calls. Only public titles, names and places were sent to Qloo.
        </span>
      </div>
      {drivers.length ? (
        <section className="rounded-2xl bg-card px-5 py-[18px]">
          <h3 className="font-display text-[15px] font-semibold">Behind the recommendations</h3>
          <p className="mb-3 text-[13px] text-muted">
            {drivers.length} lines. Open a receipt to see the call, the input and how the verdict
            was reached.
          </p>
          <EvidenceTable rows={drivers} />
        </section>
      ) : null}
      {rest.length ? (
        <section className="rounded-2xl bg-card px-5 py-[18px]">
          <h3 className="font-display text-[15px] font-semibold">All other lines</h3>
          <p className="mb-3 text-[13px] text-muted">
            {rest.length} more calls, grouped. Open a group to read it.
          </p>
          {[...groups].map(([group, list]) => (
            <details key={group} className="py-1">
              <summary className="cursor-pointer py-1.5 font-semibold">
                {group}{' '}
                <span className="rounded-full bg-surface2 px-1.5 text-[11px] tabular-nums">
                  {list.length}
                </span>
              </summary>
              <EvidenceTable rows={list} />
            </details>
          ))}
        </section>
      ) : null}
      {rows.length ? (
        <ChartCard
          title="Calls by endpoint"
          table={{ head: ['Endpoint', 'Calls'], rows: [...byEndpoint].map(([e, n]) => [e, n]) }}
        >
          <HBars
            items={[...byEndpoint].map(([e, n]) => ({
              label: e,
              value: String(n),
              width: (n / max) * 100,
              tip: `${e}: ${n} calls`,
            }))}
          />
        </ChartCard>
      ) : (
        <p className="rounded-xl bg-card p-7 text-center text-muted">
          No Qloo calls were needed for this output.
        </p>
      )}
      {builtOn && (output.kind === 'scenario' || output.kind === 'rescue') ? (
        <div className="rounded-2xl bg-card px-4 py-3.5">
          <b>Lines not listed here were not rerun.</b>
          <p className="text-muted">
            Their evidence is in {builtOn.label}.{' '}
            <Link
              href={`/outputs/${builtOn.id}?tab=evidence`}
              className="text-accent underline underline-offset-2"
            >
              Open that evidence
            </Link>
          </p>
        </div>
      ) : null}
      <div className="rounded-2xl bg-card px-4 py-3.5">
        <b>Limits of this evidence</b>
        <p className="text-muted">{output.limits}</p>
      </div>
    </>
  );
}

function verdictRank(v: Verdict | undefined): number {
  if (v === 'breaks') return 0;
  if (v === 'weak') return 1;
  if (v === 'cant') return 2;
  if (v === 'holds') return 3;
  return 5;
}

function EvidenceTable({
  rows,
}: {
  rows: { lineId: string; label: string; verdict?: Verdict; returned: string }[];
}) {
  const { receipt, openReceipt } = useOutputView();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {['Line', 'What came back', 'Confidence', ''].map((h) => (
              <th
                key={h}
                className="border-b border-line px-2 py-1.5 text-left font-semibold text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = receipt(row.lineId);
            return (
              <tr key={row.lineId} className="align-top">
                <td className="border-b border-line px-2 py-1.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.label} {row.verdict ? <VerdictPill verdict={row.verdict} /> : null}
                  </span>
                  <span className="font-mono text-[11px] text-muted">{r?.endpoint}</span>
                </td>
                <td className="max-w-[340px] border-b border-line px-2 py-1.5">{row.returned}</td>
                <td className="border-b border-line px-2 py-1.5">
                  {r ? <Confidence level={r.confidence} suffix="" /> : null}
                </td>
                <td className="border-b border-line px-2 py-1.5">
                  <ReceiptChip onClick={() => openReceipt(row.lineId)} aria-label="Open receipt" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
