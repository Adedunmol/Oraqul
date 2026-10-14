'use client';

import { Chip, Confidence, ReceiptChip } from '@oraqul/ui';
import type { ReactNode } from 'react';
import { useOutputView } from './context';

/** Small marker after a line title, such as "Unstated" or "Chosen". */
export function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1.5 inline-block rounded bg-accent-soft px-1.5 py-px align-middle text-[11px] font-semibold text-accent">
      {children}
    </span>
  );
}

export function ChangeMark({ lineId }: { lineId: string }) {
  const { change } = useOutputView();
  const c = change(lineId);
  if (!c) return null;
  return <Mark>{c.before === null ? 'New' : 'Updated'}</Mark>;
}

/** Confidence and the receipt chip for a line, when the line has a receipt. */
export function Evidence({ lineId, confidence = true }: { lineId: string; confidence?: boolean }) {
  const { receipt, openReceipt } = useOutputView();
  const r = receipt(lineId);
  if (!r) return null;
  return (
    <>
      {confidence ? <Confidence level={r.confidence} /> : null}
      <ReceiptChip onClick={() => openReceipt(lineId)} aria-label="Open receipt" />
    </>
  );
}

/**
 * A line item. A changed line gets the accent fill, the word "Updated" or "New", and what it was
 * before. design-system §7.8
 */
export function Line({
  lineId,
  title,
  tags,
  children,
  side,
}: {
  lineId?: string;
  title: ReactNode;
  tags?: ReactNode;
  children?: ReactNode;
  side?: ReactNode;
}) {
  const { change } = useOutputView();
  const c = lineId ? change(lineId) : undefined;
  return (
    <div
      className={`grid grid-cols-1 items-start gap-x-4 gap-y-2.5 rounded-xl border px-4 py-3.5 min-[900px]:grid-cols-[minmax(0,1fr)_auto] ${c ? 'border-accent/40 bg-accent-soft' : 'border-transparent bg-card'}`}
    >
      <div className="min-w-0">
        <h4 className="text-sm font-semibold">
          {title}
          {tags}
          {lineId ? <ChangeMark lineId={lineId} /> : null}
        </h4>
        {children ? (
          <div className="mt-0.5 flex flex-col gap-0.5 text-[13px] text-muted">{children}</div>
        ) : null}
        {c?.before ? <p className="mt-1 text-xs text-muted">Was: {c.before}</p> : null}
      </div>
      {side ? (
        <div className="flex flex-wrap items-center gap-2 min-[900px]:justify-end">{side}</div>
      ) : null}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
      {children}
    </section>
  );
}

export function TabTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
      {note ? <p className="max-w-[62ch] text-muted">{note}</p> : null}
    </div>
  );
}

export const Num = ({ children }: { children: ReactNode }) => (
  <b className="font-mono text-sm tabular-nums">{children}</b>
);

export function FitBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-[90px] overflow-hidden rounded-full bg-surface2">
      <i className="grow-x block h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

export { Chip };
