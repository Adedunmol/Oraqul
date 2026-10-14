import type { Confidence as LineConfidence } from '@oraqul/schema';

type Level = LineConfidence | 'low';

const levels: Record<Level, { word: string; bars: number }> = {
  high: { word: 'High', bars: 3 },
  medium: { word: 'Medium', bars: 2 },
  low: { word: 'Low', bars: 1 },
  lower: { word: 'Lower', bars: 1 },
};

/**
 * Takes the data value and draws a word with a three bar meter in neutral ink, never a
 * percentage and never verdict colours. design-system §7.6
 */
export function Confidence({ level, suffix = 'confidence' }: { level: Level; suffix?: string }) {
  const { word, bars } = levels[level];
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-[7px] bg-surface2 px-2 py-0.5 text-xs font-medium text-ink">
      {word}
      {suffix ? ` ${suffix}` : ''}
      <span aria-hidden="true" className="flex gap-px">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-2 w-1.5 ${n <= bars ? 'bg-muted' : 'bg-ink/15'}`} />
        ))}
      </span>
    </span>
  );
}
