/**
 * Live check of three ways to shape a signal (decisions D18, D29, D30): whether a person added
 * to a bundle of comps makes the list more specific, whether `filter.exclude.tags` removes a
 * kind of drift from an open list, and whether a weight on the signal gives the lead more pull.
 *
 *   pnpm --filter @oraqul/engine qloo:signal-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing. Copy conclusions into docs/backend/qloo.md, not names or scores. About 40 calls.
 */
import type { QlooEntityType } from '@oraqul/schema';
import { insights, lookup, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 });

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

async function top(name: string, type: QlooEntityType): Promise<string | null> {
  const { data } = await lookup.search(qloo, { query: name, types: [type], take: 1 });
  return data.results[0]?.entity_id ?? null;
}

async function ids(names: string[], type: QlooEntityType): Promise<string[]> {
  const out: string[] = [];
  for (const n of names) {
    const id = await top(n, type);
    if (id) out.push(id);
  }
  return out;
}

type Listed = { id: string; name: string }[];

async function list(
  type: 'movie' | 'book' | 'podcast' | 'tv_show',
  params: object,
): Promise<Listed> {
  const { data } = await insights.entities(qloo, {
    'filter.type': `urn:entity:${type}` as 'urn:entity:movie',
    take: 10,
    ...params,
  });
  return data.results.entities.map((e) => ({ id: e.entity_id, name: e.name }));
}

const names = (l: Listed) => l.map((e) => e.name).join(' | ') || '(nothing)';
const shared = (a: Listed, b: Listed) => a.filter((x) => b.some((y) => y.id === x.id)).length;

const people: {
  label: string;
  type: 'movie' | 'book' | 'podcast';
  of: QlooEntityType;
  comps: string[];
  person: string;
}[] = [
  {
    label: 'film: a director with three crime films',
    type: 'movie',
    of: 'urn:entity:movie',
    comps: ['City of God', 'Sicario', 'Heat'],
    person: 'Denis Villeneuve',
  },
  {
    label: 'books: an author with two of her books',
    type: 'book',
    of: 'urn:entity:book',
    comps: ['Americanah', 'Purple Hibiscus'],
    person: 'Chimamanda Ngozi Adichie',
  },
  {
    label: 'podcasts: a host with two true crime shows',
    type: 'podcast',
    of: 'urn:entity:podcast',
    comps: ['Serial', 'Crime Junkie'],
    person: 'Karen Kilgariff',
  },
];

await step('D18: a person added to the comps', async () => {
  for (const p of people) {
    const comps = await ids(p.comps, p.of);
    const person = await top(p.person, 'urn:entity:person');
    console.log(`${p.label}: ${comps.length} comps, person ${person ? 'found' : 'not found'}`);
    if (comps.length === 0 || !person) continue;
    const plain = await list(p.type, { 'signal.interests.entities': comps });
    const withPerson = await list(p.type, { 'signal.interests.entities': [...comps, person] });
    console.log(`  comps only: ${names(plain)}`);
    console.log(`  with person: ${names(withPerson)}`);
    console.log(`  shared ${shared(plain, withPerson)} of ${plain.length}`);
  }
});

await step('D30: a weight on the lead title', async () => {
  const comps = await ids(['City of God', 'Sicario', 'Heat'], 'urn:entity:movie');
  const base = await list('movie', { 'signal.interests.entities': comps });
  console.log(`no weight: ${names(base)}`);
  const forms: [string, unknown][] = [
    ['word high', 'high'],
    ['number 5', 5],
    ['one per entity [5,1,1]', [5, 1, 1]],
  ];
  for (const [label, weight] of forms) {
    try {
      const l = await list('movie', {
        'signal.interests.entities': comps,
        'signal.interests.entities.weight': weight,
      });
      console.log(`${label}: shared ${shared(base, l)} of ${base.length}: ${names(l)}`);
    } catch (err) {
      console.log(
        `${label}: ${err instanceof QlooError ? `${err.kind} ${err.message}` : String(err)}`,
      );
    }
  }
});

await step('D29: excluding tags from an open list that drifts', async () => {
  const comps = await ids(['Americanah', 'Purple Hibiscus'], 'urn:entity:book');
  const base = await list('tv_show', { 'signal.interests.entities': comps });
  console.log(`series for a book audience: ${names(base)}`);
  const found = await lookup.tags(qloo, { 'filter.query': 'documentary', take: 5 });
  const tag = found.data.results.tags.find((t) => (t.id ?? '').includes('genre'))?.id;
  console.log(`tag: ${tag ?? '(none)'}`);
  if (!tag) return;
  const names1 = await list('tv_show', {
    'signal.interests.entities': comps,
    'filter.exclude.tags': [tag],
  });
  console.log(`excluded: shared ${shared(base, names1)} of ${base.length}: ${names(names1)}`);
  const names2 = await list('tv_show', {
    'signal.interests.entities': comps,
    'filter.exclude.tags': [tag],
    'operator.filter.exclude.tags': 'union',
  });
  console.log(`excluded with operator.filter.exclude.tags=union: ${names(names2)}`);
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
