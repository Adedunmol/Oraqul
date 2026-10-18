/**
 * Live check of the Music query catalog (docs/product/spec.md §4.2) on one brief: an established
 * Afrobeats artist with sound-alike artists, touring Lagos, London, Accra and Atlanta. It settles
 * the Music `TODO(verify)` items in docs/backend/qloo.md: does an artist work as an anchor on its
 * own, what a debut artist falls back to, and whether artist signals give usable lists for support
 * acts, series, films, brands, podcasts and campuses.
 *
 *   pnpm --filter @oraqul/engine qloo:music-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing, because Qloo's terms on republishing responses are not confirmed. Copy conclusions
 * into the docs, not names or scores. About 60 calls.
 */
import {
  audienceOutputSchema,
  insights,
  lookup,
  QlooClient,
  QlooError,
  rankPlacesOutputSchema,
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

const lead = 'Tems';
// Not a real artist: stands in for a debut that Qloo does not know yet.
const debut = 'Zanzibar Quill Ensemble';
const comps = ['Ayra Starr', 'Rema', 'Omah Lay'];
const cities = ['Lagos', 'London', 'Accra', 'Atlanta'];

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    const detail = err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err);
    console.log(`failed: ${detail}`);
  }
}

async function list(label: string, request: insights.EntityInsightsRequest): Promise<string[]> {
  const { data } = await insights.entities(qloo, { take: 6, ...request });
  const names = data.results.entities.map((e) => e.name);
  console.log(`${label}: ${names.length ? names.join(' | ') : '(nothing)'}`);
  return names;
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

let leadId: string | null = null;
let compIds: string[] = [];

await step('Names: an established artist, a debut, and sound-alikes', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: [lead, debut, ...comps],
    types: ['urn:entity:artist'],
  });
  const out = resolveBundleOutputSchema.parse(data);
  for (const a of out.anchors) {
    console.log(`${a.name}: ${a.status}, popularity ${a.popularity ?? 'n/a'}`);
  }
  leadId = out.anchors.find((a) => a.name === lead)?.entityId ?? null;
  compIds = out.anchors.filter((a) => comps.includes(a.name)).flatMap((a) => a.entityId ?? []);
});

if (!leadId || compIds.length === 0) {
  console.log('The lead or the comps did not resolve, stopping.');
  process.exit(0);
}
const alone = { 'signal.interests.entities': [leadId] };
const bundle = { 'signal.interests.entities': [leadId, ...compIds] };

await step('Audience: the artist alone, and with sound-alikes', async () => {
  for (const [label, entityIds] of [
    ['artist alone', [leadId as string]],
    ['sound-alikes only', compIds],
    ['artist + sound-alikes', [leadId as string, ...compIds]],
  ] as const) {
    const { data } = await tools.audienceBySegment.run(ctx, { entityIds: [...entityIds] });
    const out = audienceOutputSchema.parse(data);
    console.log(`${label}: ${out.segments.length} of ${entityIds.length} anchors have an age row`);
  }
});

await step('Cities: heatmap cells for artist anchors, with leave one out', async () => {
  for (const [label, entityIds] of [
    ['artist alone', [leadId as string]],
    ['artist + sound-alikes', [leadId as string, ...compIds]],
  ] as const) {
    const { data } = await tools.rankPlaces.run(ctx, { entityIds: [...entityIds], places: cities });
    const out = rankPlacesOutputSchema.parse(data);
    console.log(
      `${label}: ${out.places
        .map((p) => `${p.place} ${p.status} cells ${p.cells} lift ${p.lift?.toFixed(2) ?? 'n/a'}`)
        .join(' | ')}`,
    );
    console.log(`  leave one out: ${JSON.stringify(out.leaveOneOut)}`);
  }
});

let scene: string | null = null;
let university: string | null = null;
let telecom: string | null = null;
let trueCrime: string | null = null;

await step('Tag lookup', async () => {
  scene = await tag('afrobeats');
  university = await tag('university', ['urn:tag:category:place']);
  telecom = await tag('telecom', undefined, 'urn:entity:brand');
  trueCrime = await tag('true crime', ['urn:tag:genre:media']);
});

await step('Support acts: artists in each tour city', async () => {
  if (!scene) return console.log('no scene tag, skipped');
  for (const city of cities) {
    await list(`artists + afrobeats + ${city} (artist + sound-alikes, anchors excluded)`, {
      'filter.type': 'urn:entity:artist',
      ...bundle,
      'filter.tags': [scene],
      'filter.exclude.entities': [leadId as string, ...compIds],
      'signal.location.query': city,
    });
  }
  const without = await list('artists + afrobeats + London (no exclude)', {
    'filter.type': 'urn:entity:artist',
    ...bundle,
    'filter.tags': [scene],
    'signal.location.query': 'London',
  });
  console.log(
    `  anchors come back without exclude: ${without.some((n) => [lead, ...comps].includes(n))}`,
  );
  await list('artists + afrobeats + London + 24 and younger', {
    'filter.type': 'urn:entity:artist',
    ...bundle,
    'filter.tags': [scene],
    'filter.exclude.entities': [leadId as string, ...compIds],
    'signal.location.query': 'London',
    'signal.demographics.age': ['24_and_younger'],
  });
});

await step('A genre tag as the only signal (the no-comps fallback)', async () => {
  if (!scene) return console.log('no scene tag, skipped');
  const { data } = await insights.demographics(qloo, { 'signal.interests.tags': [scene] });
  console.log(`demographics rows for the tag: ${data.results.demographics.length}`);
  await list('artists with the afrobeats tag as the signal + Lagos', {
    'filter.type': 'urn:entity:artist',
    'signal.interests.tags': [scene],
    'signal.location.query': 'Lagos',
  });
});

await step('Series and films (sync)', async () => {
  for (const city of ['London', 'Atlanta']) {
    await list(`tv shows + ${city} + 2020 on (artist signal)`, {
      'filter.type': 'urn:entity:tv_show',
      ...bundle,
      'signal.location.query': city,
      'filter.release_year.min': 2020,
    });
  }
  await list('films since 2023 (artist signal, no country)', {
    'filter.type': 'urn:entity:movie',
    ...bundle,
    'filter.release_year.min': 2023,
  });
  await list('films + release country Nigeria + 2022 on (artist signal)', {
    'filter.type': 'urn:entity:movie',
    ...bundle,
    'filter.release_country': ['Nigeria'],
    'filter.release_year.min': 2022,
  });
});

await step('Brands and podcasts', async () => {
  await list('brands + Lagos (no tag)', {
    'filter.type': 'urn:entity:brand',
    ...bundle,
    'signal.location.query': 'Lagos',
  });
  if (telecom) {
    await list('brands + telecom + London', {
      'filter.type': 'urn:entity:brand',
      ...bundle,
      'filter.tags': [telecom],
      'signal.location.query': 'London',
    });
  }
  await list('podcasts + London (artist signal)', {
    'filter.type': 'urn:entity:podcast',
    ...bundle,
    'signal.location.query': 'London',
  });
  if (trueCrime) {
    await list('podcasts + true crime + London (artist signal)', {
      'filter.type': 'urn:entity:podcast',
      ...bundle,
      'filter.tags': [trueCrime],
      'signal.location.query': 'London',
    });
  }
});

await step('Campuses (community)', async () => {
  if (!university) return console.log('no university tag, skipped');
  for (const city of ['London', 'Atlanta']) {
    await list(`campuses + ${city}`, {
      'filter.type': 'urn:entity:place',
      ...bundle,
      'filter.tags': [university],
      'filter.location.query': city,
    });
  }
});

await step('Theme tags on artists (is a themes query worth having?)', async () => {
  for (const type of ['theme', 'archetype', 'audience']) {
    const typed = await insights.tags(qloo, {
      ...bundle,
      'filter.tag.types': [`urn:tag:${type}:qloo`],
      take: 8,
    });
    console.log(`${type}: ${typed.data.results.tags.map((t) => t.name).join(' | ') || '(none)'}`);
  }
});

await step('The artist alone as the signal (stronger or noisier than the bundle?)', async () => {
  await list('artists + afrobeats + Lagos, artist alone', {
    'filter.type': 'urn:entity:artist',
    ...alone,
    ...(scene ? { 'filter.tags': [scene] } : {}),
    'filter.exclude.entities': [leadId as string],
    'signal.location.query': 'Lagos',
  });
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
