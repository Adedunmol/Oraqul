/**
 * Live check of candidate Film queries before they join the catalog (docs/backend/qloo.md): does a
 * film comp signal give usable lists of games, books, other kinds of places, and archetype and
 * audience tags, once it carries context.
 *
 *   pnpm --filter @oraqul/engine qloo:catalog-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye and saves
 * nothing. About 45 calls.
 */
import {
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

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 80, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };
const comps = (process.env.PROBE_COMPS ?? 'King of Boys,Gangs of Lagos,Citation').split(',');
const compTypes = (process.env.PROBE_TYPES ?? 'urn:entity:movie,urn:entity:tv_show').split(',');
const phrasesToTry = (
  process.env.PROBE_PLACES ?? 'bar,restaurant,night club,coffee shop,bookstore,gym'
).split(',');

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

async function list(label: string, request: insights.EntityInsightsRequest): Promise<void> {
  try {
    const { data } = await insights.entities(qloo, { take: 6, ...request });
    const names = data.results.entities.map((e) => e.name);
    console.log(`${label}: ${names.length ? names.join(' | ') : '(nothing)'}`);
  } catch (err) {
    console.log(`${label}: failed ${err instanceof QlooError ? err.kind : String(err)}`);
  }
}

async function tag(query: string, types?: string[]): Promise<string | null> {
  const { data } = await lookup.tags(qloo, {
    'filter.query': query,
    ...(types ? { 'filter.tag.types': types } : {}),
    take: 3,
  });
  console.log(
    `tags "${query}"${types ? ` in ${types.join(',')}` : ''}: ${data.results.tags.map((t) => `${t.id} (${t.name})`).join(' | ') || '(none)'}`,
  );
  return data.results.tags[0]?.id ?? null;
}

let ids: string[] = [];
await step('Comps', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: comps,
    types: compTypes as never,
  });
  ids = resolveBundleOutputSchema.parse(data).entityIds;
  console.log(`${ids.length} comps resolved`);
});
if (ids.length === 0) process.exit(0);
const signal = { 'signal.interests.entities': ids };

await step('Video games', async () => {
  for (const city of ['Lagos', 'London']) {
    await list(`games + ${city} (no tag)`, {
      'filter.type': 'urn:entity:videogame',
      ...signal,
      'signal.location.query': city,
    });
  }
  const action = await tag('action', ['urn:tag:genre:media']);
  if (action) {
    await list('games + action tag + London', {
      'filter.type': 'urn:entity:videogame',
      ...signal,
      'filter.tags': [action],
      'signal.location.query': 'London',
    });
  }
});

await step('Books', async () => {
  const crime = await tag('crime', ['urn:tag:genre:media']);
  const thriller = await tag('thriller', ['urn:tag:genre:media']);
  for (const [label, t] of [
    ['crime', crime],
    ['thriller', thriller],
  ] as const) {
    if (!t) continue;
    await list(`books + ${label} + Lagos + 2018 on`, {
      'filter.type': 'urn:entity:book',
      ...signal,
      'filter.tags': [t],
      'signal.location.query': 'Lagos',
      'filter.publication_year.min': 2018,
    });
  }
  await list('books + London (no tag)', {
    'filter.type': 'urn:entity:book',
    ...signal,
    'signal.location.query': 'London',
  });
});

await step('Other places', async () => {
  for (const phrase of phrasesToTry) {
    const t = await tag(phrase, ['urn:tag:category:place']);
    if (!t) continue;
    for (const city of ['Lagos', 'London']) {
      await list(`${phrase} + ${city}`, {
        'filter.type': 'urn:entity:place',
        ...signal,
        'filter.tags': [t],
        'filter.location.query': city,
      });
    }
  }
});

await step('Archetype and audience tags', async () => {
  const out = await tools.themeTags.run(ctx, { entityIds: ids, kinds: ['archetype', 'audience'] });
  console.log(JSON.stringify(out.data, null, 0).slice(0, 700));
});
