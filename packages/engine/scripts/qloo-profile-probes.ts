/**
 * Live check of what `/entities` carries for the anchors of Film, Music and Podcasts
 * (decisions D14, D15, D16): the properties and tag kinds, and whether they are enough to
 * check that a set of comps fit together or to filter by content rating.
 *
 *   pnpm --filter @oraqul/engine qloo:profile-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing. Copy conclusions into docs/backend/qloo.md, not names or scores. About 12 calls.
 */
import type { QlooEntityType } from '@oraqul/schema';
import { lookup, QlooClient, type QlooEntity, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 25, timeoutMs: 120_000 });

const groups: { label: string; type: QlooEntityType; names: string[] }[] = [
  { label: 'D14 Film comps', type: 'urn:entity:movie', names: ['City of God', 'Sicario', 'Heat'] },
  {
    label: 'D15 Music anchors',
    type: 'urn:entity:artist',
    names: ['Burna Boy', 'Wizkid', 'Davido'],
  },
  {
    label: 'D16 Podcast shows',
    type: 'urn:entity:podcast',
    names: ['Serial', 'My Favorite Murder', 'Crime Junkie'],
  },
];

const short = (v: unknown) => JSON.stringify(v).slice(0, 90);

async function show(group: (typeof groups)[number]): Promise<void> {
  const ids: string[] = [];
  for (const name of group.names) {
    const { data } = await lookup.search(qloo, { query: name, types: [group.type], take: 1 });
    const top = data.results[0];
    if (top) ids.push(top.entity_id);
  }
  const { data } = await lookup.entities(qloo, ids);
  const rows: QlooEntity[] = data.results;
  const keys = new Map<string, number>();
  for (const e of rows) {
    for (const k of Object.keys(e.properties ?? {})) keys.set(k, (keys.get(k) ?? 0) + 1);
  }
  console.log(
    `properties on ${rows.length} entities: ${[...keys].map(([k, n]) => `${k} ${n}`).join(', ')}`,
  );
  for (const e of rows) {
    const p = e.properties ?? {};
    const kinds = new Map<string, number>();
    for (const t of e.tags ?? []) {
      const kind = t.type?.match(/^urn:tag:([a-z_]+):/)?.[1] ?? 'other';
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    console.log(`- ${e.name}`);
    for (const k of [
      'genres',
      'keywords',
      'content_rating',
      'production_companies',
      'duration',
      'release_year',
      'country',
      'languages',
      'description',
    ]) {
      if (k in p) console.log(`    ${k}: ${short((p as Record<string, unknown>)[k])}`);
    }
    for (const kind of ['genre', 'subgenre', 'theme', 'audience']) {
      const names = (e.tags ?? []).filter((t) => t.type?.includes(`:${kind}:`)).map((t) => t.name);
      if (names.length) console.log(`    ${kind}: ${names.slice(0, 8).join(', ')}`);
    }
    console.log(`    tag kinds: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ') || '(none)'}`);
  }
}

for (const group of groups) {
  console.log(`\n## ${group.label}`);
  try {
    await show(group);
  } catch (err) {
    console.log(
      `failed: ${err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err)}`,
    );
  }
}
console.log(`\nCalls made: ${qloo.callsUsed}`);
