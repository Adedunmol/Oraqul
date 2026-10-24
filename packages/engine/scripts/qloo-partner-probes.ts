/**
 * Live check of the partner side before it is trusted (docs/backend/qloo.md): do the seed brands
 * resolve by exact name, and which brand categories give brands that operate in a city.
 *
 *   pnpm --filter @oraqul/engine qloo:partner-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye and saves
 * nothing. About 60 calls.
 */

import type { SeenEntity, ToolContext } from '../src';
import { insights, lookup, QlooClient, QlooError, resolveBundleOutputSchema, tools } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;
if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 120, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const seeds = (
  process.env.PROBE_SEEDS ?? 'Guinness,MTN,Indomie,Verve,QuickTeller,EE,Monzo,Lyft,Cash App,Bolt'
).split(',');
const phrases = (
  process.env.PROBE_CATEGORIES ??
  'apparel,beauty,food,coffee,hardware,energy drink,snack,ticketing,payments,bank,lifestyle,fashion'
).split(',');
const cities = (process.env.PROBE_CITIES ?? 'Lagos,London').split(',');
const artists = (process.env.PROBE_ARTISTS ?? 'Burna Boy,Wizkid,Davido').split(',');

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

await step('Seed brands, by exact name', async () => {
  for (const name of seeds) {
    const { data } = await lookup.search(qloo, {
      query: name,
      types: ['urn:entity:brand'],
      take: 3,
    });
    const top = data.results.map((r) => `${r.name} (${r.popularity ?? 'no popularity'})`);
    const exact = data.results.some((r) => r.name.toLowerCase() === name.toLowerCase());
    console.log(`${name}: ${exact ? 'EXACT' : 'no exact match'} | ${top.join(' | ') || '(none)'}`);
  }
});

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

await step('Brand categories, per city', async () => {
  for (const phrase of phrases) {
    const { data } = await lookup.tags(qloo, {
      'filter.query': phrase,
      'filter.parents.types': ['urn:entity:brand'],
      take: 3,
    });
    const tag = data.results.tags[0];
    console.log(
      `tag "${phrase}": ${data.results.tags.map((t) => `${t.id} (${t.name})`).join(' | ') || '(none)'}`,
    );
    if (!tag) continue;
    for (const city of cities) {
      try {
        const { data: list } = await insights.entities(qloo, {
          take: 6,
          'filter.type': 'urn:entity:brand',
          'signal.interests.entities': signal,
          'filter.tags': [tag.id],
          'signal.location.query': city,
          'filter.popularity.min': 0.4,
          'filter.popularity.max': 0.85,
        });
        const names = list.results.entities.map((e) => e.name);
        console.log(`  ${phrase} in ${city}: ${names.length ? names.join(' | ') : '(nothing)'}`);
      } catch (err) {
        console.log(`  ${phrase} in ${city}: failed ${err instanceof QlooError ? err.kind : err}`);
      }
    }
  }
});
