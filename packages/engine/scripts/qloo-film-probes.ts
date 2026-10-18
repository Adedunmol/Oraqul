/**
 * Live check of the Film query catalog (docs/product/spec.md, Film queries) on the Third Bridge
 * brief: does a comp signal give usable lists once it carries context (a scene tag, a release
 * country, a city, an age band, a year), and which shaping parameters Qloo applies.
 *
 *   pnpm --filter @oraqul/engine qloo:film-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing, because Qloo's terms on republishing responses are not confirmed. Copy conclusions
 * into the docs, not names or scores. About 50 calls.
 */
import {
  analysis,
  insights,
  lookup,
  QlooClient,
  QlooError,
  resolveBundleOutputSchema,
  type SeenEntity,
  type ToolContext,
  tools,
} from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const comps = ['King of Boys', 'Gangs of Lagos', 'Citation'];
const cities = ['Lagos', 'London', 'Houston', 'Atlanta'];

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    const detail = err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err);
    console.log(`failed: ${detail}`);
  }
}

async function list(label: string, request: insights.EntityInsightsRequest): Promise<void> {
  const { data } = await insights.entities(qloo, { take: 6, ...request });
  const names = data.results.entities.map((e) => e.name);
  console.log(`${label}: ${names.length ? names.join(' | ') : '(nothing)'}`);
}

async function tag(
  query: string,
  types?: string[],
  parent?: 'urn:entity:brand',
): Promise<string | null> {
  const { data } = await lookup.tags(qloo, {
    'filter.query': query,
    ...(types ? { 'filter.tag.types': types } : {}),
    ...(parent ? { 'filter.parents.types': [parent] } : {}),
    take: 5,
  });
  const rows = data.results.tags.map((t) => `${t.id} (${t.name})`);
  console.log(
    `tags "${query}"${types ? ` in ${types.join(',')}` : ''}: ${rows.join(' | ') || '(none)'}`,
  );
  return data.results.tags[0]?.id ?? null;
}

let ids: string[] = [];

await step('Comps', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: comps,
    types: ['urn:entity:movie', 'urn:entity:tv_show'],
  });
  const out = resolveBundleOutputSchema.parse(data);
  for (const a of out.anchors) console.log(`${a.name}: ${a.status}`);
  ids = out.entityIds;
});

if (ids.length === 0) {
  console.log('No comps resolved, stopping.');
  process.exit(0);
}
const signal = { 'signal.interests.entities': ids };

let afrobeats: string | null = null;
let theater: string | null = null;
let worship: string | null = null;
let university: string | null = null;
let beverage: string | null = null;
let telecom: string | null = null;

await step('Tag lookup', async () => {
  afrobeats = await tag('afrobeats');
  theater = await tag('movie theater', ['urn:tag:category:place']);
  worship = await tag('church', ['urn:tag:category:place']);
  university = await tag('university', ['urn:tag:category:place']);
  // Without a parent type these phrases match place categories, not brand ones.
  beverage = await tag('beverage', undefined, 'urn:entity:brand');
  telecom = await tag('telecom', undefined, 'urn:entity:brand');
});

await step('Artists', async () => {
  await list('artists + Lagos (no tag)', {
    'filter.type': 'urn:entity:artist',
    ...signal,
    'signal.location.query': 'Lagos',
  });
  if (!afrobeats) return console.log('no afrobeats tag, skipped the tagged lists');
  for (const city of ['Lagos', 'London']) {
    await list(`artists + afrobeats + ${city}`, {
      'filter.type': 'urn:entity:artist',
      ...signal,
      'filter.tags': [afrobeats],
      'signal.location.query': city,
    });
  }
  await list('artists + afrobeats + London + 24 and younger', {
    'filter.type': 'urn:entity:artist',
    ...signal,
    'filter.tags': [afrobeats],
    'signal.location.query': 'London',
    'signal.demographics.age': ['24_and_younger'],
  });
  await list('artists + afrobeats + Lagos + 25 to 29 and 30 to 34', {
    'filter.type': 'urn:entity:artist',
    ...signal,
    'filter.tags': [afrobeats],
    'signal.location.query': 'Lagos',
    'signal.demographics.age': ['25_to_29', '30_to_34'],
  });
});

await step('Films and shows', async () => {
  await list('films since 2024 (no country)', {
    'filter.type': 'urn:entity:movie',
    ...signal,
    'filter.release_year.min': 2024,
  });
  await list('films + release country Nigeria + 2022 on', {
    'filter.type': 'urn:entity:movie',
    ...signal,
    'filter.release_country': ['Nigeria'],
    'filter.release_year.min': 2022,
  });
  await list('films + release country NG (code) + 2022 on', {
    'filter.type': 'urn:entity:movie',
    ...signal,
    'filter.release_country': ['NG'],
    'filter.release_year.min': 2022,
  });
  for (const city of ['Atlanta', 'London']) {
    await list(`tv shows + ${city} + 2020 on`, {
      'filter.type': 'urn:entity:tv_show',
      ...signal,
      'signal.location.query': city,
      'filter.release_year.min': 2020,
    });
  }
});

await step('Places', async () => {
  for (const [label, t] of [
    ['cinemas', theater],
    ['worship', worship],
    ['campuses', university],
  ] as const) {
    if (!t) {
      console.log(`${label}: no tag, skipped`);
      continue;
    }
    for (const city of label === 'cinemas' ? cities : ['Houston', 'London']) {
      await list(`${label} + ${city}`, {
        'filter.type': 'urn:entity:place',
        ...signal,
        'filter.tags': [t],
        'filter.location.query': city,
      });
    }
  }
});

await step('Brands', async () => {
  await list('brands + Lagos (no tag)', {
    'filter.type': 'urn:entity:brand',
    ...signal,
    'signal.location.query': 'Lagos',
  });
  for (const [label, t] of [
    ['beverage', beverage],
    ['telecom', telecom],
  ] as const) {
    if (!t) {
      console.log(`${label}: no tag, skipped`);
      continue;
    }
    for (const city of ['Lagos', 'London']) {
      await list(`brands + ${label} + ${city}`, {
        'filter.type': 'urn:entity:brand',
        ...signal,
        'filter.tags': [t],
        'signal.location.query': city,
      });
    }
  }
});

await step('Podcasts', async () => {
  for (const city of ['Lagos', 'London']) {
    await list(`podcasts + ${city}`, {
      'filter.type': 'urn:entity:podcast',
      ...signal,
      'signal.location.query': city,
    });
  }
  await list('podcasts + true crime tag + London', {
    'filter.type': 'urn:entity:podcast',
    ...signal,
    'signal.location.query': 'London',
    'filter.tags': ['urn:tag:genre:media:true_crime'],
  });
});

await step('Theme tags on the comps', async () => {
  const { data } = await insights.tags(qloo, { ...signal, take: 12 });
  console.log(data.results.tags.map((t) => `${t.name} [${t.subtype ?? t.type ?? ''}]`).join(' | '));
  for (const type of ['theme', 'archetype', 'audience', 'plot']) {
    const typed = await insights.tags(qloo, {
      ...signal,
      'filter.tag.types': [`urn:tag:${type}:qloo`],
      take: 8,
    });
    console.log(`${type}: ${typed.data.results.tags.map((t) => t.name).join(' | ')}`);
  }
});

await step('Distinct tags (compare against genre peers)', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: ['Sicario', 'The Departed', 'City of God'],
    types: ['urn:entity:movie'],
  });
  const peers = resolveBundleOutputSchema.parse(data).entityIds;
  if (peers.length === 0) return console.log('no peers resolved');
  const out = await analysis.compare(qloo, { a: ids, b: peers, take: 10 });
  console.log(JSON.stringify(out.data).slice(0, 1200));
});

await step('Community audiences as a signal', async () => {
  const { data } = await lookup.audiences(qloo, { 'filter.query': 'black', take: 5 });
  console.log(data.results.audiences.map((a) => `${a.id} (${a.name})`).join(' | '));
  const first = data.results.audiences[0];
  if (!first) return;
  await list(`tv shows + Houston + audience ${first.name}`, {
    'filter.type': 'urn:entity:tv_show',
    ...signal,
    'signal.location.query': 'Houston',
    'signal.demographics.audiences': [first.id],
  });
});

await step('A cast member as a signal', async () => {
  const { data } = await lookup.search(qloo, {
    query: 'Sola Sobowale',
    types: ['urn:entity:person'],
    take: 3,
  });
  const person = data.results[0];
  console.log(`search: ${data.results.map((r) => r.name).join(' | ') || '(none)'}`);
  if (!person) return;
  await list('films with the actor as the only signal', {
    'filter.type': 'urn:entity:movie',
    'signal.interests.entities': [person.entity_id],
  });
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
