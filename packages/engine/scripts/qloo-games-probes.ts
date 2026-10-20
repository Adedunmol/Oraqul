/**
 * Live check of the Games query catalog (docs/product/spec.md §4.3) on one brief: an established
 * roguelike with comparable games, planned for Steam and Switch. It settles the Games
 * `TODO(verify)` items in docs/backend/qloo.md: whether a game works as an anchor, whether its
 * audience gives usable lists for each fan base (music, series, anime, films, brands, podcasts,
 * other games), whether heatmaps and `/entities` metadata exist for games, and whether Qloo
 * knows streamers.
 *
 *   pnpm --filter @oraqul/engine qloo:games-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing, because Qloo's terms on republishing responses are not confirmed. Copy conclusions
 * into the docs, not names or scores. About 70 calls.
 */
import {
  audienceOutputSchema,
  compareAudiencesOutputSchema,
  compareTypeOf,
  gameProfilesOutputSchema,
  insights,
  lookup,
  QlooClient,
  QlooError,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  type SeenEntity,
  type ToolContext,
  themeTagsOutputSchema,
  tools,
} from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 90, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const lead = 'Hades';
// Not a real game: stands in for a debut that Qloo does not know yet.
const debut = 'Zanzibar Quill Odyssey';
const comps = ['Dead Cells', 'Slay the Spire', 'Hollow Knight'];
const cities = ['Los Angeles', 'London', 'Seoul', 'Singapore', 'Stockholm'];

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    const detail = err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err);
    console.log(`failed: ${detail}`);
  }
}

async function list(
  label: string,
  request: insights.EntityInsightsRequest,
): Promise<{ id: string; name: string; affinity: number | null }[]> {
  const { data } = await insights.entities(qloo, { take: 6, ...request });
  const rows = data.results.entities.map((e) => ({
    id: e.entity_id,
    name: e.name,
    affinity: e.query?.affinity ?? null,
  }));
  console.log(`${label}: ${rows.length ? rows.map((r) => r.name).join(' | ') : '(nothing)'}`);
  return rows;
}

async function tag(query: string, types?: string[]): Promise<string | null> {
  const { data } = await lookup.tags(qloo, {
    'filter.query': query,
    ...(types ? { 'filter.tag.types': types } : {}),
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

await step('Names: an established game, a debut, and comparable games', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: [lead, debut, ...comps],
    types: ['urn:entity:videogame'],
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
const bundle = { 'signal.interests.entities': [leadId, ...compIds] };
const anchors = [leadId as string, ...compIds];

await step('Metadata: /entities for games (platforms, rating, tags, franchise)', async () => {
  const { data } = await tools.gameProfiles.run(ctx, { entityIds: anchors });
  for (const g of gameProfilesOutputSchema.parse(data).games) {
    console.log(
      `${g.name}: platforms ${g.platforms.join(',') || '(none)'} | rating ${g.contentRating ?? 'n/a'} | franchise ${g.franchise ?? 'n/a'} | tag kinds ${Object.keys(g.tags).join(',') || '(none)'}`,
    );
  }
});

await step('Audience: age and gender rows for game anchors', async () => {
  const { data } = await tools.audienceBySegment.run(ctx, { entityIds: anchors });
  const out = audienceOutputSchema.parse(data);
  console.log(`${out.segments.length} of ${anchors.length} anchors have an age row`);
});

await step('Regions: heatmap cells for a game signal, with leave one out', async () => {
  const { data } = await tools.rankPlaces.run(ctx, { entityIds: anchors, places: cities });
  const out = rankPlacesOutputSchema.parse(data);
  console.log(
    out.places
      .map((p) => `${p.place} ${p.status} cells ${p.cells} lift ${p.lift?.toFixed(2) ?? 'n/a'}`)
      .join(' | '),
  );
  console.log(`leave one out: ${JSON.stringify(out.leaveOneOut)}`);
});

await step('Does a location query change a game list?', async () => {
  for (const city of ['Seoul', 'London']) {
    await list(`games + ${city}`, {
      'filter.type': 'urn:entity:videogame',
      ...bundle,
      'filter.exclude.entities': anchors,
      'signal.location.query': city,
    });
  }
});

let animeTag: string | null = null;
let gamePodcastTag: string | null = null;
let rogueTag: string | null = null;

await step('Tag lookup: how game genres, anime and gaming podcasts are named', async () => {
  rogueTag = await tag('roguelike');
  animeTag = await tag('anime', ['urn:tag:genre:media']);
  gamePodcastTag = await tag('video games', ['urn:tag:genre:media']);
  await tag('platformer');
});

const fanBases: [string, insights.EntityInsightsRequest][] = [
  ['music artists', { 'filter.type': 'urn:entity:artist' }],
  ['series', { 'filter.type': 'urn:entity:tv_show' }],
  ['films', { 'filter.type': 'urn:entity:movie' }],
  ['brands', { 'filter.type': 'urn:entity:brand' }],
  ['podcasts', { 'filter.type': 'urn:entity:podcast' }],
  ['other games', { 'filter.type': 'urn:entity:videogame', 'filter.exclude.entities': anchors }],
];
const discovered = new Map<string, { id: string; name: string; affinity: number | null }[]>();

await step('Fan bases: what a game audience likes in each medium', async () => {
  for (const [label, request] of fanBases) {
    discovered.set(label, await list(`${label}`, { ...bundle, ...request }));
  }
  if (animeTag) {
    discovered.set(
      'anime',
      await list('series + anime tag', {
        'filter.type': 'urn:entity:tv_show',
        ...bundle,
        'filter.tags': [animeTag],
      }),
    );
  }
});

await step('Scoring named candidates in every medium (filter.results.entities)', async () => {
  for (const [label, rows] of discovered) {
    const asked = fanBases.find(([l]) => l === label)?.[1]['filter.type'] ?? 'urn:entity:tv_show';
    const type = compareTypeOf([asked]);
    if (!type) continue;
    const ids = rows.slice(0, 3).map((r) => r.id);
    if (ids.length < 2) {
      console.log(`${label}: fewer than two candidates, skipped`);
      continue;
    }
    const { data } = await tools.compareAudiences.run(ctx, {
      entityIds: anchors,
      type,
      rivals: ids,
      leaveOneOut: false,
    });
    const scored = compareAudiencesOutputSchema.parse(data).rivals;
    const same = rows
      .slice(0, 3)
      .map((r, i) => {
        const a = scored[i]?.overlap;
        const open = r.affinity === null ? null : Math.round(r.affinity * 100);
        return `${r.name} open ${open ?? 'n/a'} / scored ${a ?? 'n/a'}`;
      })
      .join(' | ');
    console.log(`${label}: ${same}`);
  }
  console.log('Open and scored values that match mean the fan base needs only the discovery call.');
});

await step('Store tags: theme, archetype and audience tags on game anchors', async () => {
  const { data } = await tools.themeTags.run(ctx, {
    entityIds: anchors,
    kinds: ['theme', 'archetype', 'audience'],
  });
  for (const k of themeTagsOutputSchema.parse(data).kinds) {
    console.log(`${k.kind}: ${k.tags.map((t) => t.name).join(' | ') || '(none)'}`);
  }
  for (const kind of ['gameplay_type', 'emotional_tone', 'platform']) {
    const typed = await insights.tags(qloo, {
      ...bundle,
      'filter.tag.types': [`urn:tag:${kind}:qloo`],
      take: 8,
    });
    console.log(`${kind}: ${typed.data.results.tags.map((t) => t.name).join(' | ') || '(none)'}`);
  }
});

await step('Press: gaming podcasts', async () => {
  if (!gamePodcastTag) return console.log('no video games tag, skipped');
  await list('podcasts + video games tag', {
    'filter.type': 'urn:entity:podcast',
    ...bundle,
    'filter.tags': [gamePodcastTag],
  });
});

await step('Creators: does a person signal give streamers?', async () => {
  await list('people (game signal)', { 'filter.type': 'urn:entity:person', ...bundle });
  await list('people (game signal) + 24 and younger', {
    'filter.type': 'urn:entity:person',
    ...bundle,
    'signal.demographics.age': ['24_and_younger'],
  });
  console.log('Creators are grounded only if these are streamers or YouTubers, not actors.');
});

await step('Brands: peripherals and drinks', async () => {
  await list('brands (game signal, no tag)', { 'filter.type': 'urn:entity:brand', ...bundle });
});

await step('Campuses (community)', async () => {
  const university = await tag('university', ['urn:tag:category:place']);
  if (!university) return console.log('no university tag, skipped');
  for (const city of ['London', 'Seoul']) {
    await list(`campuses + ${city}`, {
      'filter.type': 'urn:entity:place',
      ...bundle,
      'filter.tags': [university],
      'filter.location.query': city,
    });
  }
});

await step('A genre tag as the only signal (the no-comps fallback)', async () => {
  if (!rogueTag) return console.log('no roguelike tag, skipped');
  const { data } = await insights.demographics(qloo, { 'signal.interests.tags': [rogueTag] });
  console.log(`demographics rows for the tag: ${data.results.demographics.length}`);
  await list('games with the roguelike tag as the signal', {
    'filter.type': 'urn:entity:videogame',
    'signal.interests.tags': [rogueTag],
  });
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
