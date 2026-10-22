/**
 * Live check of two small levers (decisions D26, D31): whether `/search` with
 * `sort_by=popularity` or `filter.popularity` puts the right title first for names that several
 * titles share, and whether `signal.demographics.gender` changes an entity list.
 *
 *   pnpm --filter @oraqul/engine qloo:search-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing. Copy conclusions into docs/backend/qloo.md, not names or scores. About 25 calls.
 */
import { insights, lookup, QlooClient, QlooError, type SearchParams } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 40, timeoutMs: 120_000 });

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    console.log(
      `failed: ${err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err)}`,
    );
  }
}

// The title meant, by name and release year, so the first hit can be judged.
const wanted = [
  { name: 'Lionheart', year: '2018', note: 'the Nigerian film' },
  { name: 'Joker', year: '2019', note: 'the Phillips film' },
  { name: 'Parasite', year: '2019', note: 'the Bong film' },
  { name: 'Dune', year: '2021', note: 'the Villeneuve film' },
  { name: 'Heat', year: '1995', note: 'the Mann film' },
];

await step('D26: first hits by default, by popularity, and with a popularity floor', async () => {
  const modes: [string, Partial<SearchParams>][] = [
    ['default', {}],
    ['sort_by=popularity', { sort_by: 'popularity' }],
    ['filter.popularity=0.3', { 'filter.popularity': 0.3 }],
  ];
  for (const w of wanted) {
    console.log(`${w.name} (meant: ${w.note}, ${w.year})`);
    for (const [label, extra] of modes) {
      const { data } = await lookup.search(qloo, {
        query: w.name,
        types: ['urn:entity:movie'],
        take: 3,
        ...extra,
      });
      const rows = data.results.map(
        (e) => `${e.name} ${e.disambiguation ?? '?'} (${e.popularity?.toFixed(2) ?? 'n/a'})`,
      );
      console.log(`  ${label}: ${rows.join(' | ') || '(nothing)'}`);
    }
  }
});

await step('D31: gender signal on entity lists', async () => {
  const seeds: [
    string,
    'urn:entity:movie' | 'urn:entity:artist' | 'urn:entity:podcast',
    string[],
  ][] = [
    ['movie', 'urn:entity:movie', ['City of God', 'Sicario', 'Heat']],
    ['artist', 'urn:entity:artist', ['Burna Boy', 'Wizkid']],
    ['podcast', 'urn:entity:podcast', ['Serial', 'Crime Junkie']],
  ];
  for (const [label, type, names] of seeds) {
    const ids: string[] = [];
    for (const n of names) {
      const { data } = await lookup.search(qloo, { query: n, types: [type], take: 1 });
      if (data.results[0]) ids.push(data.results[0].entity_id);
    }
    for (const gender of [undefined, 'female', 'male'] as const) {
      const { data } = await insights.entities(qloo, {
        // The list is the same kind as the signal; the union request type cannot show that.
        'filter.type': type as 'urn:entity:movie',
        'signal.interests.entities': ids,
        ...(gender ? { 'signal.demographics.gender': gender } : {}),
        take: 6,
      });
      console.log(
        `${label} signal, gender ${gender ?? 'none'}: ${data.results.entities.map((e) => e.name).join(' | ')}`,
      );
    }
  }
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
