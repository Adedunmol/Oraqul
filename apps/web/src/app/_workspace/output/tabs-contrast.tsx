'use client';

import { VerdictPill } from '@oraqul/ui';
import type { ReactNode } from 'react';
import { useOutputView } from './context';
import { Num, Section, Stack, TabTitle } from './line';
import { contrastOf } from './plan-views';

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col rounded-2xl bg-card px-[18px] py-3.5">
      <span className="text-[13px] text-muted">{label}</span>
      <b className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{value}</b>
      <span className="text-[13px] text-muted">{note}</span>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-[18px]">{children}</div>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The plan beside what the same team would have had without the data. Every figure is counted from
 * the saved plan, so it is a measure of this plan and not a claim about assistants in general.
 */
export function ContrastTab() {
  const { output } = useOutputView();
  const c = contrastOf(output);
  if (!c) return null;
  const { basis, beliefs, added, order } = c;
  const lines = basis.grounded + basis.playbook;
  return (
    <>
      <TabTitle
        title="With and without Qloo"
        note="What the data changed in this plan, counted from the plan itself. Without Qloo you keep your own order and beliefs, and the plan can only hold launch practice."
      />
      <Stack>
        {order ? (
          <Card>
            <Section title="Where to open">
              <p className="text-[13px] text-muted">
                {order.moved === 0
                  ? 'Qloo ranks your cities in the order you gave them.'
                  : `Qloo moves ${plural(order.moved, 'of your cities')} from the order you gave.`}
              </p>
            </Section>
            <div className="grid gap-4 min-[700px]:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-[12px] font-semibold text-muted">Without Qloo: your order</h4>
                <ol className="flex flex-col gap-1 text-sm">
                  {order.yours.map((p, i) => (
                    <li key={p.name}>
                      {i + 1}. {p.name}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-col gap-1.5">
                <h4 className="text-[12px] font-semibold text-muted">With Qloo: by lift</h4>
                <ol className="flex flex-col gap-1 text-sm">
                  {order.ranked.map((p, i) => (
                    <li key={p.name} className="flex flex-wrap items-center gap-2">
                      <span>
                        {i + 1}. {p.name}
                      </span>
                      <Num>{p.lift.toFixed(1)}x</Num>
                      {p.verdict ? <VerdictPill verdict={p.verdict} /> : null}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-3.5">
          <Tile
            label="Lines that cite Qloo"
            value={`${basis.grounded} of ${lines}`}
            note={`${plural(basis.findings, 'finding')} behind them`}
          />
          <Tile
            label="Playbook lines"
            value={String(basis.playbook)}
            note="Launch practice, the part that needs no data"
          />
          <Tile
            label="Receipts"
            value={String(basis.receipts)}
            note="Each one opens the Qloo call it came from"
          />
        </div>

        <Card>
          <Section title="Beliefs the data tested">
            <p className="text-[13px] text-muted">
              {beliefs.overturned === 0
                ? 'None of the beliefs the plan rests on was weakened or broken by the data.'
                : `${plural(beliefs.overturned, 'belief')} the plan rested on ${beliefs.overturned === 1 ? 'was' : 'were'} weakened or broken by the data. Without Qloo they would have stayed in the plan.`}
            </p>
          </Section>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <VerdictPill verdict="holds" /> {beliefs.holds}
            </span>
            <span className="flex items-center gap-1.5">
              <VerdictPill verdict="weak" /> {beliefs.weak}
            </span>
            <span className="flex items-center gap-1.5">
              <VerdictPill verdict="breaks" /> {beliefs.breaks}
            </span>
            <span className="flex items-center gap-1.5">
              <VerdictPill verdict="cant" /> {beliefs.cant}
            </span>
          </div>
        </Card>

        <Card>
          <Section title="Named by Qloo">
            <p className="text-[13px] text-muted">
              {plural(added.named, 'title, place or brand', 'titles, places and brands')} came from
              what Qloo returned.
              {added.comps.length > 0
                ? ` Comparable titles Qloo added to yours: ${added.comps.join(', ')}.`
                : ''}
            </p>
          </Section>
        </Card>
      </Stack>
    </>
  );
}
