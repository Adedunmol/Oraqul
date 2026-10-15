'use client';

import type { Verdict, VerdictCounts } from '@oraqul/schema';
import { Button } from '@oraqul/ui';
import { type ReactNode, useState } from 'react';

// Charts are CSS, with a legend, hover text through `data-tip` (see tooltip.tsx) and a table
// toggle. Colour comes from the chart and verdict tokens and never carries meaning alone.

export type Tone = 'series' | 'series2' | 'good' | 'warn' | 'crit' | 'na';

export const toneClass: Record<Tone, string> = {
  series: 'bg-s1',
  series2: 'bg-s2',
  good: 'bg-good',
  warn: 'bg-warn',
  crit: 'bg-crit',
  na: 'bg-na',
};

export const verdictTone: Record<Verdict, Tone> = {
  holds: 'good',
  weak: 'warn',
  breaks: 'crit',
  cant: 'na',
};

export const verdictWord: Record<Verdict, string> = {
  holds: 'Holds',
  weak: 'Weak',
  breaks: 'Breaks',
  cant: 'Could not test',
};

export const verdictGlyph: Record<Verdict, string> = {
  holds: '✓',
  weak: '◐',
  breaks: '✕',
  cant: '◌',
};

const verdicts: Verdict[] = ['holds', 'weak', 'breaks', 'cant'];

export interface TableData {
  head: string[];
  rows: (string | number)[][];
}

export function DataTable({ head, rows }: TableData) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((h) => (
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
          {rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell, i) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells of one row have no identity of their own
                  key={i}
                  className="border-b border-line px-2 py-1.5 tabular-nums"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A chart in a card with a title, a note and a "View as table" toggle. design-system §7.16 */
export function ChartCard({
  title,
  note,
  table,
  children,
}: {
  title: string;
  note?: string;
  table: TableData;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-2xl bg-card px-5 py-[18px]">
      <div className="mb-3 flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
          {note ? <p className="text-[13px] text-muted">{note}</p> : null}
        </div>
        <Button
          size="small"
          variant="ghost"
          icon={asTable ? 'projects' : 'overview'}
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? 'Show chart' : 'View as table'}
        </Button>
      </div>
      {asTable ? <DataTable {...table} /> : children}
    </section>
  );
}

export function Legend({ items }: { items: { tone: Tone; label: ReactNode }[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-3.5 text-[13px]">
      {items.map((item, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: legends are fixed lists
          key={i}
          className="inline-flex items-center gap-1.5"
        >
          <i aria-hidden="true" className={`size-2.5 rounded-[3px] ${toneClass[item.tone]}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export interface BarItem {
  label: string;
  /** What is printed at the end of the bar, already formatted. */
  value: string;
  /** Bar length, 0 to 100. */
  width: number;
  tone?: Tone;
  tip?: string;
}

export function HBars({ items }: { items: BarItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div
          key={item.label}
          data-tip={item.tip ?? `${item.label}: ${item.value}`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the hover text through focus
          tabIndex={0}
          className="grid grid-cols-[minmax(90px,1fr)_minmax(0,1.4fr)_40px] items-center gap-2.5 py-1 min-[900px]:grid-cols-[minmax(110px,170px)_minmax(0,1fr)_44px]"
        >
          <span className="text-[13px]">{item.label}</span>
          <span className="flex h-[18px] items-center">
            <i
              className={`grow-x block h-4 min-w-0.5 rounded-r-[5px] ${toneClass[item.tone ?? 'series']}`}
              style={{ width: `${Math.max(0, Math.min(100, item.width))}%` }}
            />
          </span>
          <span className="text-right font-mono text-xs text-muted tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/** One stacked bar of verdict counts, with glyph and word in the legend. */
export function VerdictBar({ counts }: { counts: VerdictCounts }) {
  const total = verdicts.reduce((sum, v) => sum + counts[v], 0) || 1;
  const summary = verdicts.map((v) => `${counts[v]} ${verdictWord[v].toLowerCase()}`).join(', ');
  return (
    <>
      <div role="img" aria-label={`Verdicts: ${summary}`} className="flex h-[22px] gap-0.5">
        {verdicts
          .filter((v) => counts[v] > 0)
          .map((v) => (
            <i
              key={v}
              data-tip={`${verdictWord[v]}: ${counts[v]} of ${total}`}
              className={`grow-x block h-full min-w-[3px] first:rounded-l-[4px] last:rounded-r-[4px] ${toneClass[verdictTone[v]]}`}
              style={{ flex: counts[v] }}
            />
          ))}
      </div>
      <Legend
        items={verdicts.map((v) => ({
          tone: verdictTone[v],
          label: (
            <>
              {verdictGlyph[v]} {verdictWord[v]} <b className="tabular-nums">{counts[v]}</b>
            </>
          ),
        }))}
      />
    </>
  );
}

export const verdictTable = (c: VerdictCounts): TableData => ({
  head: ['Verdict', 'Count'],
  rows: verdicts.map((v) => [verdictWord[v], c[v]]),
});

/** Paired columns, such as planned against actual. Values are percent. */
export function GroupedColumns({
  labels,
  a,
  b,
  nameA,
  nameB,
}: {
  labels: string[];
  a: number[];
  b: number[];
  nameA: string;
  nameB: string;
}) {
  const max = Math.max(20, Math.ceil(Math.max(...a, ...b) / 10) * 10);
  const h = (v: number) => `${Math.round((v / max) * 100)}%`;
  return (
    <>
      <div
        role="img"
        aria-label={`${nameA} against ${nameB}`}
        className="flex h-[200px] items-end gap-[clamp(10px,4vw,34px)] border-b border-line px-2 pt-1.5"
      >
        {labels.map((label, i) => (
          <div
            key={label}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-[3px]"
          >
            <i
              data-tip={`${label}, ${nameA}: ${a[i] ?? 0}%`}
              className="grow-y block min-h-0.5 w-[min(24px,40%)] rounded-t bg-s1"
              style={{ height: h(a[i] ?? 0) }}
            />
            <i
              data-tip={`${label}, ${nameB}: ${b[i] ?? 0}%`}
              className="grow-y block min-h-0.5 w-[min(24px,40%)] rounded-t bg-s2"
              style={{ height: h(b[i] ?? 0) }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[clamp(10px,4vw,34px)] px-2 pt-1.5 text-xs text-muted">
        {labels.map((label) => (
          <span key={label} className="min-w-0 flex-1 text-center">
            {label}
          </span>
        ))}
      </div>
      <Legend
        items={[
          { tone: 'series', label: nameA },
          { tone: 'series2', label: nameB },
        ]}
      />
    </>
  );
}

/** One stacked column of verdict counts per output, for how a plan moved. */
export function StackedColumns({
  columns,
}: {
  columns: { label: string; counts: VerdictCounts }[];
}) {
  const totals = columns.map((c) => verdicts.reduce((sum, v) => sum + c.counts[v], 0));
  const max = Math.max(1, ...totals);
  return (
    <>
      <div className="flex h-[200px] items-end gap-[clamp(10px,4vw,34px)] border-b border-line px-2 pt-1.5">
        {columns.map((col, i) => (
          <div key={col.label} className="flex h-full min-w-0 flex-1 items-end justify-center">
            <div
              className="flex w-[min(34px,60%)] flex-col-reverse gap-0.5"
              style={{ height: `${Math.round(((totals[i] ?? 0) / max) * 100)}%` }}
            >
              {verdicts
                .filter((v) => col.counts[v] > 0)
                .map((v) => (
                  <i
                    key={v}
                    data-tip={`${col.label}, ${verdictWord[v]}: ${col.counts[v]}`}
                    className={`grow-y block min-h-[3px] w-full last:rounded-t ${toneClass[verdictTone[v]]}`}
                    style={{ flex: col.counts[v] }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[clamp(10px,4vw,34px)] px-2 pt-1.5 text-xs text-muted">
        {columns.map((col) => (
          <span key={col.label} className="min-w-0 flex-1 text-center">
            {col.label}
          </span>
        ))}
      </div>
      <Legend
        items={verdicts.map((v) => ({
          tone: verdictTone[v],
          label: `${verdictGlyph[v]} ${verdictWord[v]}`,
        }))}
      />
    </>
  );
}

/** Before and after bars per row, such as fan base overlap with and without a collab. */
export function PairBars({
  items,
  nameA,
  nameB,
}: {
  items: { label: string; a: number; b: number }[];
  nameA: string;
  nameB: string;
}) {
  return (
    <>
      {items.map((item) => (
        <div
          key={item.label}
          data-tip={`${item.label}: ${nameA} ${item.a}, ${nameB} ${item.b}`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the hover text through focus
          tabIndex={0}
          className="grid grid-cols-[minmax(90px,1fr)_minmax(0,1.4fr)_60px] items-center gap-2.5 py-1.5 min-[900px]:grid-cols-[minmax(110px,170px)_minmax(0,1fr)_70px]"
        >
          <span className="text-[13px]">{item.label}</span>
          <div className="flex flex-col gap-[3px]">
            <i
              className="grow-x block h-[9px] min-w-0.5 rounded-r bg-na"
              style={{ width: `${item.a}%` }}
            />
            <i
              className="grow-x block h-[9px] min-w-0.5 rounded-r bg-s1"
              style={{ width: `${item.b}%` }}
            />
          </div>
          <span className="text-right font-mono text-xs text-muted tabular-nums">
            {item.a === item.b ? item.a : `${item.a} to ${item.b}`}
          </span>
        </div>
      ))}
      <Legend
        items={[
          { tone: 'na', label: nameA },
          { tone: 'series', label: nameB },
        ]}
      />
    </>
  );
}
