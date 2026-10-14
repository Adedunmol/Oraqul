import type { Verdict } from '@oraqul/schema';

const verdicts: Record<Verdict, { word: string; glyph: string; className: string }> = {
  holds: { word: 'Holds', glyph: '✓', className: 'bg-holds-bg text-holds' },
  weak: { word: 'Weak', glyph: '◐', className: 'bg-weak-bg text-weak' },
  breaks: { word: 'Breaks', glyph: '✕', className: 'bg-breaks-bg text-breaks' },
  cant: { word: 'Could not test', glyph: '◌', className: 'bg-cant-bg text-cant' },
};

/** Takes the data value and draws glyph and word, so colour never carries meaning alone. */
export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const { word, glyph, className } = verdicts[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold ${className}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {word}
    </span>
  );
}
