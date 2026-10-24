import { wrap } from '../section';

const TOOLS: { name: string; does: string }[] = [
  { name: 'searchEntity', does: 'Finds a title, artist, brand or place in Qloo by name.' },
  {
    name: 'resolveBundle',
    does: 'Describes a launch as a bundle of comparable titles, one exact match each.',
  },
  {
    name: 'audienceBySegment',
    does: 'Age and gender skews for an audience, as an index per segment.',
  },
  { name: 'rankPlaces', does: 'Ranks cities by audience strength from one Qloo call.' },
  { name: 'lift', does: 'Scores candidates against a baseline from one ranking call.' },
  { name: 'scoreRivals', does: 'How much of an audience each rival release shares, in one call.' },
  {
    name: 'findTaste',
    does: 'What an audience likes in one kind of entity, shaped by place and age.',
  },
  {
    name: 'partnerFit',
    does: 'Brands, podcasts and series a film or title audience also likes, ranked by Qloo for one signal.',
  },
  { name: 'topicMap', does: 'The topics an audience carries that rival shows’ audiences do not.' },
  { name: 'resolveTags', does: 'Turns a phrase into a Qloo tag, or null. Never a guess.' },
  { name: 'themeTags', does: 'The theme and archetype tags that best describe a set of titles.' },
  {
    name: 'filmProfiles, bookProfiles, gameProfiles',
    does: 'What Qloo lists for each title. Nothing is scored.',
  },
];

const code = 'rounded-lg bg-inset px-3 py-2 font-mono text-[13px] leading-[1.6] text-ink';

export function DevelopersBody() {
  return (
    <div className={`${wrap} flex max-w-[860px] flex-col gap-12 py-[clamp(56px,8vw,112px)]`}>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          Run it
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          The server speaks MCP over stdio. It runs on demo data unless you set{' '}
          <code className="font-mono text-[15px]">QLOO_MODE=live</code> and a Qloo key.
        </p>
        <pre className={code}>
          {'pnpm --filter @oraqul/mcp build\nnode packages/mcp/dist/stdio.js'}
        </pre>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          What a call returns
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.65] text-ink/80">
          Every tool returns its data and one receipt for each Qloo call it made, as JSON text. A
          score, a verdict or a confidence in the data was computed by code from what Qloo returned.
          The tools send only public names, place names and age bands to Qloo.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          Tools
        </h2>
        <ul className="overflow-hidden rounded-2xl bg-card">
          {TOOLS.map((t) => (
            <li
              key={t.name}
              className="grid gap-1 border-b border-line px-5 py-3.5 last:border-0 min-[700px]:grid-cols-[260px_minmax(0,1fr)] min-[700px]:gap-4"
            >
              <code className="font-mono text-[13.5px] font-medium">{t.name}</code>
              <span className="text-[15px] text-ink/80">{t.does}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
