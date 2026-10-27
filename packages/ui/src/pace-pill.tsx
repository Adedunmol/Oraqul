import type { PaceVerdict, WatchSeverity } from '@oraqul/schema';

const paces: Record<PaceVerdict, { word: string; glyph: string; className: string }> = {
  ahead: { word: 'Ahead', glyph: '▲', className: 'bg-holds-bg text-holds' },
  'on-pace': { word: 'On pace', glyph: '✓', className: 'bg-holds-bg text-holds' },
  behind: { word: 'Behind', glyph: '▼', className: 'bg-breaks-bg text-breaks' },
  'too-early': { word: 'Too early to tell', glyph: '◌', className: 'bg-cant-bg text-cant' },
};

const severities: Record<WatchSeverity, { word: string; glyph: string; className: string }> = {
  info: { word: 'Info', glyph: '○', className: 'bg-cant-bg text-cant' },
  watch: { word: 'Watch', glyph: '◐', className: 'bg-weak-bg text-weak' },
  act: { word: 'Act', glyph: '▲', className: 'bg-breaks-bg text-breaks' },
};

const pill = 'inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold';

/** Where the team's figures stand against the plan's pace. Glyph and word, so colour never carries it alone. */
export function PacePill({ verdict }: { verdict: PaceVerdict }) {
  const { word, glyph, className } = paces[verdict];
  return (
    <span className={`${pill} ${className}`}>
      <span aria-hidden="true">{glyph}</span>
      {word}
    </span>
  );
}

/** How much a watch event needs a person. Glyph and word. */
export function SeverityPill({ severity }: { severity: WatchSeverity }) {
  const { word, glyph, className } = severities[severity];
  return (
    <span className={`${pill} ${className}`}>
      <span aria-hidden="true">{glyph}</span>
      {word}
    </span>
  );
}
