import type { Verdict } from '@oraqul/schema';

const verdicts: Record<Verdict, { word: string; glyph: string; className: string }> = {
  holds: { word: 'Holds', glyph: '✓', className: 'bg-holds-bg text-holds' },
  weak: { word: 'Weak', glyph: '◐', className: 'bg-weak-bg text-weak' },
  breaks: { word: 'Breaks', glyph: '✕', className: 'bg-breaks-bg text-breaks' },
  cant: { word: 'Could not test', glyph: '◌', className: 'bg-cant-bg text-cant' },
};

/**
 * What "could not test" says when the reason is known: the person can add something, Qloo had no
 * exact read, or the check failed this time. The data value stays the same.
 */
const cantWords = {
  input: 'Not tested yet',
  'no-signal': 'No exact read',
  failed: 'Could not check this time',
} as const;

/** Takes the data value and draws glyph and word, so colour never carries meaning alone. */
export function VerdictPill({
  verdict,
  cantKind,
}: {
  verdict: Verdict;
  cantKind?: keyof typeof cantWords;
}) {
  const { word: base, glyph, className } = verdicts[verdict];
  const word = verdict === 'cant' && cantKind ? cantWords[cantKind] : base;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold ${className}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {word}
    </span>
  );
}
