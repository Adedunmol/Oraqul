import { Confidence, VerdictPill } from '@oraqul/ui';
import type { SampleLine } from './sample';

/**
 * A receipt in words. It names no endpoint and shows no response, so it cannot be mistaken for
 * raw Qloo data (the terms on public receipts are unconfirmed).
 */
export function ReceiptCard({ line }: { line: SampleLine }) {
  const rows: [string, string][] = [
    ['Input', line.receipt.input],
    ['Returned', line.receipt.returned],
    ['How it was decided', line.receipt.decided],
  ];
  return (
    <section aria-label="Example receipt" className="flex flex-col gap-4 rounded-xl bg-inset p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted">Receipt</p>
        <span className="font-mono text-xs text-muted">{line.receipt.callId}</span>
      </div>
      <p className="font-display text-[16px] font-semibold tracking-[-0.02em]">{line.claim}</p>
      <div className="flex flex-wrap items-center gap-2">
        <VerdictPill verdict={line.verdict} />
        <Confidence level={line.confidence} />
      </div>
      <dl className="flex flex-col gap-2.5">
        {rows.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-0.5">
            <dt className="text-[12.5px] text-muted">{term}</dt>
            <dd className="text-[14px]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
