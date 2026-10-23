import type { Direction } from '@oraqul/schema';

const directions: Record<Direction, { word: string; glyph: string; className: string }> = {
  okay: { word: 'Okay', glyph: '✓', className: 'bg-holds-bg text-holds' },
  risky: { word: 'Risky', glyph: '◐', className: 'bg-weak-bg text-weak' },
  avoid: { word: 'Avoid', glyph: '✕', className: 'bg-breaks-bg text-breaks' },
};

/**
 * The call on a decision. It takes the data value and draws glyph and word, like a verdict, so
 * colour never carries meaning alone (design-system §7.5a).
 */
export function DirectionPill({ direction }: { direction: Direction }) {
  const { word, glyph, className } = directions[direction];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold ${className}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {word}
    </span>
  );
}
