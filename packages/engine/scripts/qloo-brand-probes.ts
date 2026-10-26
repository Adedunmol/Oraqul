/**
 * Live check of how partner brands are found (docs/backend/qloo.md): the brands a category gives
 * for an audience in a city, with and without a popularity band, and whether a list we choose can
 * be ranked for a city and an age band with no comps behind it.
 *
 *   pnpm --filter @oraqul/engine qloo:brand-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye and saves
 * nothing. About 25 calls.
 */

import type { SeenEntity, ToolContext } from '../src';
import { insights, lookup, QlooClient, QlooError, resolveBundleOutputSchema, tools } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;
if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const categories = (process.env.PROBE_CATEGORIES ?? 'beverage,telecom').split(',');
const cities = (process.env.PROBE_CITIES ?? 'Lagos,London').split(',');
const artists = (process.env.PROBE_ARTISTS ?? 'Burna Boy,Wizkid,Davido').split(',');
const age = (process.env.PROBE_AGE ?? '25_to_29') as '25_to_29';

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

const show = (e: { name: string; popularity?: number | null; query?: { affinity?: number } }) =>
  `${e.name} (pop ${e.popularity ?? '-'}, aff ${e.query?.affinity?.toFixed(2) ?? '-'})`;

let signal: string[] = [];
await step('Artists as the audience signal', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: artists,
    types: ['urn:entity:artist'] as never,
  });
  signal = resolveBundleOutputSchema.parse(data).entityIds;
  console.log(`${signal.length} artists resolved`);
});
if (signal.length === 0) process.exit(0);

const pools = new Map<string, { id: string; name: string }[]>();
await step('Discovery: a category with a city, mid-size band and open', async () => {
  for (const phrase of categories) {
    const { data } = await lookup.tags(qloo, {
      'filter.query': phrase,
      'filter.parents.types': ['urn:entity:brand'],
      take: 1,
    });
    const tag = data.results.tags[0];
    if (!tag) {
      console.log(`tag "${phrase}": none`);
      continue;
    }
    for (const city of cities) {
      for (const band of [true, false]) {
        const { data: list } = await insights.entities(qloo, {
          take: 4,
          'filter.type': 'urn:entity:brand',
          'signal.interests.entities': signal,
          'filter.tags': [tag.id],
          'signal.location.query': city,
          ...(band ? { 'filter.popularity.min': 0.4, 'filter.popularity.max': 0.85 } : {}),
        });
        const found = list.results.entities;
        console.log(
          `  ${phrase} in ${city}, ${band ? 'mid band' : 'open'}: ${found.map(show).join(' | ') || '(nothing)'}`,
        );
        pools.set(city, [
          ...(pools.get(city) ?? []),
          ...found.map((e) => ({ id: e.entity_id, name: e.name })),
        ]);
      }
    }
  }
});

await step('Ranking one pool: with the comps, and for the city and age band alone', async () => {
  for (const city of cities) {
    const pool = [...new Map((pools.get(city) ?? []).map((p) => [p.id, p])).values()];
    if (pool.length < 3) {
      console.log(`${city}: pool of ${pool.length}, skipped`);
      continue;
    }
    const only = pool.map((p) => p.id);
    const withComps = await insights.entities(qloo, {
      take: only.length,
      'filter.type': 'urn:entity:brand',
      'signal.interests.entities': signal,
      'signal.location.query': city,
      'filter.results.entities': only,
    });
    console.log(
      `${city}, with the comps: ${withComps.data.results.entities.map(show).join(' | ')}`,
    );
    try {
      const alone = await insights.entities(qloo, {
        take: only.length,
        'filter.type': 'urn:entity:brand',
        'signal.location.query': city,
        'signal.demographics.age': [age],
        'filter.results.entities': only,
      });
      console.log(
        `${city}, ${age} alone: ${alone.data.results.entities.map(show).join(' | ') || '(nothing)'}`,
      );
    } catch (err) {
      console.log(`${city}, ${age} alone: failed ${err instanceof QlooError ? err.kind : err}`);
    }
  }
});
