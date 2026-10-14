import type { Verdict } from '@oraqul/schema';
import { VerdictPill } from '@oraqul/ui';

const lines: { claim: string; detail: string; verdict: Verdict }[] = [
  {
    claim: 'Fans of the comparison series are your core audience.',
    detail: 'Their taste overlaps with your lead in the launch cities.',
    verdict: 'holds',
  },
  {
    claim: 'Lagos is a strong opening city.',
    detail: 'Taste fit is well above a neutral audience in the same place.',
    verdict: 'holds',
  },
  {
    claim: 'Your lead market is the right first stop.',
    detail: 'A stronger lead came back, and it is now in the plan.',
    verdict: 'breaks',
  },
];

/** A mock of the real output. The label says so, because it is not data from a real project. */
export function ExampleAnswer() {
  return (
    <section aria-label="Example of an Oraqul answer" className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Example answer
      </p>
      {lines.map((line, index) => (
        <div
          key={line.claim}
          className="preview-rise flex flex-col gap-2 rounded-xl bg-surface px-4 py-3.5"
          style={{ animationDelay: `${index * 140}ms` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{line.claim}</p>
            <VerdictPill verdict={line.verdict} />
          </div>
          <p className="text-sm text-muted">{line.detail}</p>
          <span className="w-fit rounded-[7px] bg-surface2 px-2 py-0.5 text-xs text-muted">
            View receipt
          </span>
        </div>
      ))}
    </section>
  );
}
