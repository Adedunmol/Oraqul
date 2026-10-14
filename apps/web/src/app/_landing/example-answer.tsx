import type { Verdict } from '@oraqul/schema';
import { VerdictPill } from '@oraqul/ui';

const lines: { claim: string; detail: string; verdict: Verdict }[] = [
  {
    claim: 'Fans of the comparison series are your core audience.',
    detail: 'Their taste overlaps with your lead in the launch cities.',
    verdict: 'holds',
  },
  {
    claim: 'Summer is the right window.',
    detail: 'Interest rises, but a bigger release lands one week earlier.',
    verdict: 'weak',
  },
  {
    claim: 'Your second market is ready.',
    detail: 'Not enough data came back for that city.',
    verdict: 'cant',
  },
];

/** A mock of the real output. It is labelled as an example because it is not data from a real project. */
export function ProductPreview() {
  return (
    <section aria-label="Example of an Oraqul answer" className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Example, not real data
      </p>
      {lines.map((line, index) => (
        <div
          key={line.claim}
          className="preview-rise flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3"
          style={{ animationDelay: `${index * 140}ms` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{line.claim}</p>
            <VerdictPill verdict={line.verdict} />
          </div>
          <p className="text-sm text-muted">{line.detail}</p>
          <span className="w-fit rounded-[7px] border border-line bg-surface px-2 py-0.5 text-xs text-muted">
            View receipt
          </span>
        </div>
      ))}
    </section>
  );
}
