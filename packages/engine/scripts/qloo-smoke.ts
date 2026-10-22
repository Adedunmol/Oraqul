/**
 * Live check of the Qloo client against our own key. Settles the open questions in
 * docs/backend/qloo.md and saves one real response per endpoint
 * and category type to packages/engine/fixtures, for offline tests.
 *
 *   pnpm --filter @oraqul/engine qloo:smoke
 *
 * Output is counts and yes/no only, no Qloo names, ids or scores. Skips without a key.
 * Fixtures are gitignored until Qloo's terms on republishing responses are confirmed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QlooEntityType } from '@oraqul/schema';
import {
  analysis,
  entityInsightsResponseSchema,
  insights,
  lookup,
  type QlooCall,
  QlooClient,
  type QlooEntity,
  QlooError,
} from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Skipping Qloo smoke test: QLOO_API_KEY and QLOO_BASE_URL are not set');
  process.exit(0);
}

// The smoke run makes about 50 calls. The monthly quota is reported near 10 000.
const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 100, timeoutMs: 60_000 });
const fixtures = new URL('../fixtures/', import.meta.url);

async function save(group: string, name: string, call: QlooCall): Promise<void> {
  const file = new URL(`${group}/${name}.json`, fixtures);
  await mkdir(dirname(fileURLToPath(file)), { recursive: true });
  const body = { input: call.input, returned: call.returned };
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`);
}

async function probe(question: string, run: () => Promise<string>): Promise<void> {
  let answer: string;
  try {
    answer = await run();
  } catch (err) {
    if (err instanceof QlooError) {
      answer = `error [${err.kind}, status ${err.call.status ?? 'none'}]: ${err.message}`;
    } else {
      answer = `error: ${err instanceof Error ? err.message : 'unknown'}`;
    }
  }
  console.log(`- ${question}\n    → ${answer}`);
}

const ids = (entities: QlooEntity[]) => entities.map((e) => e.entity_id);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

interface Category {
  label: string;
  type: QlooEntityType;
  query: string;
}

const categories: Category[] = [
  { label: 'movie', type: 'urn:entity:movie', query: 'Black Panther' },
  { label: 'tv_show', type: 'urn:entity:tv_show', query: 'Money Heist' },
  { label: 'artist', type: 'urn:entity:artist', query: 'Burna Boy' },
  { label: 'book', type: 'urn:entity:book', query: 'Things Fall Apart' },
  { label: 'podcast', type: 'urn:entity:podcast', query: 'The Daily' },
  { label: 'videogame', type: 'urn:entity:videogame', query: 'Elden Ring' },
];

console.log(`Qloo smoke test against ${baseUrl}\n`);

// 1. Resolve one title per category, and save the lookup responses.
const resolved = new Map<string, string>();
const movieHits: string[] = [];
for (const c of categories) {
  await probe(`search ${c.label}`, async () => {
    const { data, call } = await lookup.search(qloo, { query: c.query, types: [c.type], take: 5 });
    await save('search', c.label, call);
    const first = data.results[0];
    if (first) resolved.set(c.label, first.entity_id);
    if (c.label === 'movie') movieHits.push(...ids(data.results));
    return `${data.results.length} hit(s); popularity on all: ${data.results.every((e) => e.popularity !== undefined)}`;
  });
}

await probe('entities by id (movie): does a title carry tags?', async () => {
  const id = resolved.get('movie');
  if (!id) return 'skipped (no movie resolved)';
  const { data, call } = await lookup.entities(qloo, [id]);
  await save('entities', 'movie', call);
  return `${data.results.length} entity; tags on it: ${data.results[0]?.tags?.length ?? 0}`;
});

await probe('entities by IMDb id (movie)', async () => {
  const { data, call } = await lookup.entitiesByExternalId(qloo, 'imdb', ['tt1825683']);
  await save('entities', 'movie-by-imdb', call);
  return `${data.results.length} entity`;
});

// 2. Insights for each category type, from a title of the same type.
const base = new Map<string, string[]>();
for (const c of categories) {
  const id = resolved.get(c.label);
  await probe(`insights ${c.label} from a ${c.label}`, async () => {
    if (!id) return 'skipped';
    const { data, call } = await insights.entities(qloo, {
      'filter.type': c.type,
      'signal.interests.entities': [id],
      take: 10,
    });
    await save('insights', c.label, call);
    base.set(c.label, ids(data.results.entities));
    return `${data.results.entities.length} result(s); affinity on all: ${data.results.entities.every((e) => e.query?.affinity !== undefined)}`;
  });
}

// 3. Open question: does a location signal change results, per type?
for (const c of categories) {
  const id = resolved.get(c.label);
  await probe(`signal.location.query=Lagos changes ${c.label} results?`, async () => {
    const before = base.get(c.label);
    if (!id || !before) return 'skipped';
    const { data } = await insights.entities(qloo, {
      'filter.type': c.type,
      'signal.interests.entities': [id],
      'signal.location.query': 'Lagos',
      take: 10,
    });
    return same(before, ids(data.results.entities))
      ? 'no (same results, so ignored or no data)'
      : 'yes';
  });
}

// 4. Cross-domain: can a movie signal rank other types? (partners, soundtrack, adjacent shows)
const movieId = resolved.get('movie');
for (const c of categories.filter((x) => x.label !== 'movie')) {
  await probe(`cross-domain: a movie as the signal for ${c.label}`, async () => {
    if (!movieId) return 'skipped';
    const { data } = await insights.entities(qloo, {
      'filter.type': c.type,
      'signal.interests.entities': [movieId],
      take: 5,
    });
    return `${data.results.entities.length} result(s)`;
  });
}
await probe('cross-domain: a movie as the signal for brand', async () => {
  if (!movieId) return 'skipped';
  const { data, call } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:brand',
    'signal.interests.entities': [movieId],
    take: 5,
  });
  await save('insights', 'brand', call);
  return `${data.results.entities.length} result(s)`;
});

// 5. Parameter behaviour.
await probe('an unknown parameter: ignored or rejected?', async () => {
  if (!movieId) return 'skipped';
  const { data } = await qloo.get(
    '/v2/insights',
    {
      'filter.type': 'urn:entity:movie',
      'signal.interests.entities': [movieId],
      'bogus.param': '1',
      take: 3,
    },
    entityInsightsResponseSchema,
  );
  return `accepted and ignored (${data.results.entities.length} result(s)), so typed filters are our only guard`;
});

await probe('page=2 differs from page 1 (movie)', async () => {
  const first = base.get('movie');
  if (!movieId || !first) return 'skipped';
  const { data } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:movie',
    'signal.interests.entities': [movieId],
    take: 10,
    page: 2,
  });
  return same(first, ids(data.results.entities)) ? 'no (same results)' : 'yes';
});

await probe('feature.explainability (movie)', async () => {
  if (!movieId) return 'skipped';
  const { data } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:movie',
    'signal.interests.entities': [movieId],
    'feature.explainability': true,
    take: 5,
  });
  const withIt = data.results.entities.filter((e) => e.query?.explainability !== undefined);
  return `${withIt.length}/${data.results.entities.length} results carry query.explainability`;
});

await probe('film filters really filter: release_year >= 2020 and PG-13 (movie)', async () => {
  if (!movieId) return 'skipped';
  const { data } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:movie',
    'signal.interests.entities': [movieId],
    'filter.release_year.min': 2020,
    'filter.content_rating': ['PG-13'],
    take: 10,
  });
  const rows = data.results.entities;
  const years = rows.filter((e) => Number(e.properties?.release_year) >= 2020).length;
  const ratings = rows.filter((e) => e.properties?.content_rating === 'PG-13').length;
  return `${rows.length} result(s); released 2020 or later: ${years}; rated PG-13: ${ratings}`;
});

await probe('what does Qloo return when nothing matches?', async () => {
  const { data } = await lookup.search(qloo, {
    query: 'zzqxjv kwpl unmatched',
    types: ['urn:entity:movie'],
    take: 3,
  });
  return `search: ${data.results.length} result(s) (not an error)`;
});

// 6. Tags and taste analysis.
let tagId: string | undefined;
await probe('tags lookup: which id field?', async () => {
  const { data, call } = await lookup.tags(qloo, { 'filter.query': 'drama', take: 5 });
  await save('tags', 'search', call);
  const first = data.results.tags[0];
  tagId = first?.id;
  return `${data.results.tags.length} tag(s), each with id and name`;
});
await probe(
  'weights change results: entity weight very_high vs very_low, with a tag signal',
  async () => {
    const tag = tagId;
    if (!movieId || !tag) return 'skipped';
    const withWeight = (weight: 'very_high' | 'very_low') =>
      insights.entities(qloo, {
        'filter.type': 'urn:entity:movie',
        'signal.interests.entities': [movieId],
        'signal.interests.tags': [tag],
        'signal.interests.entities.weight': weight,
        take: 10,
      });
    const high = await withWeight('very_high');
    const low = await withWeight('very_low');
    return same(ids(high.data.results.entities), ids(low.data.results.entities))
      ? 'no (same results, so weights are ignored here)'
      : 'yes';
  },
);
await probe('tag types', async () => {
  const { call } = await lookup.tagTypes(qloo, { take: 5 });
  await save('tags', 'types', call);
  return `status ${call.status}`;
});
await probe('tag insights from a movie (urn:tag)', async () => {
  if (!movieId) return 'skipped';
  const { data, call } = await insights.tags(qloo, {
    'signal.interests.entities': [movieId],
    take: 10,
  });
  await save('insights', 'tags', call);
  return `${data.results.tags.length} tag(s); with affinity: ${data.results.tags.filter((t) => t.query?.affinity !== undefined).length}`;
});

// 7. Demographics, heatmap, compare, trending.
await probe('demographics from a movie', async () => {
  if (!movieId) return 'skipped';
  const { data, call } = await insights.demographics(qloo, {
    'signal.interests.entities': [movieId],
  });
  await save('insights', 'demographics', call);
  const row = data.results.demographics[0];
  return `${data.results.demographics.length} row(s); age bands: ${Object.keys(row?.query.age ?? {}).length}; genders: ${Object.keys(row?.query.gender ?? {}).length}`;
});
await probe('demographics from a tag, entity and tag together', async () => {
  if (!movieId || !tagId) return 'skipped';
  const { data } = await insights.demographics(qloo, {
    'signal.interests.entities': [movieId],
    'signal.interests.tags': [tagId],
  });
  return `${data.results.demographics.length} row(s) for 2 signals`;
});
await probe('heatmap: Lagos, geohash cells', async () => {
  if (!movieId) return 'skipped';
  const { data, call } = await insights.heatmap(qloo, {
    'filter.location.query': 'Lagos',
    'signal.interests.entities': [movieId],
    take: 20,
  });
  await save('insights', 'heatmap', call);
  return `${data.results.heatmap.length} cell(s)`;
});
await probe('compare two movies: result shape', async () => {
  const [a, b] = movieHits;
  if (!a || !b) return 'skipped (fewer than 2 movie hits)';
  const { data, call } = await analysis.compare(qloo, { a: [a], b: [b], take: 20 });
  await save('analysis', 'compare', call);
  const r = data.results;
  return `shared tags: ${r.tags?.length ?? 'absent'}; side a: ${r.a?.length ?? 'absent'}; side b: ${r.b?.length ?? 'absent'}; scores on shared: ${r.tags?.filter((t) => t.query?.score !== undefined).length ?? 0}`;
});
await probe('trending for a movie, last 365 days', async () => {
  if (!movieId) return 'skipped';
  const day = 24 * 60 * 60 * 1000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const { data, call } = await analysis.trending(qloo, {
    'filter.type': 'urn:entity:movie',
    'signal.interests.entities': [movieId],
    'filter.start_date': iso(Date.now() - 365 * day),
    'filter.end_date': iso(Date.now()),
  });
  await save('analysis', 'trending', call);
  return `${data.results.trending.length} weekly point(s)`;
});

// 8. Coverage: do Nigerian titles and artists resolve?
const coverage: Category[] = [
  { label: 'Nigerian film', type: 'urn:entity:movie', query: 'Lionheart' },
  { label: 'Nigerian series', type: 'urn:entity:tv_show', query: 'Blood Sisters' },
  { label: 'Nigerian artist', type: 'urn:entity:artist', query: 'Wizkid' },
  { label: 'Nigerian author', type: 'urn:entity:book', query: 'Half of a Yellow Sun' },
];
for (const c of coverage) {
  await probe(`coverage: ${c.label} resolves by name?`, async () => {
    const { data } = await lookup.search(qloo, { query: c.query, types: [c.type], take: 5 });
    const exact = data.results.some((e) => normalize(e.name) === normalize(c.query));
    return `${data.results.length} hit(s); exact title match: ${exact}`;
  });
}

console.log(`\nDone. ${qloo.callsUsed} network call(s). Fixtures are in packages/engine/fixtures.`);
