/**
 * Live check of the Podcasts query catalog (docs/product/spec.md §4.4) on one brief: an established
 * true crime show with comparable shows, planned for London and Lagos. It settles the Podcasts
 * `TODO(verify)` items in docs/backend/qloo.md: whether a podcast works as an anchor, whether its
 * audience gives usable lists for shows, brands, artists and series, whether heatmaps exist for a
 * podcast signal, what `/v2/analysis/compare` returns for two groups of shows (the topic map), and
 * whether Qloo knows hosts and guests.
 *
 *   pnpm --filter @oraqul/engine qloo:podcasts-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing, because Qloo's terms on republishing responses are not confirmed. Copy conclusions
 * into the docs, not names or scores. About 40 calls.
 */
import {
  analysis,
  audienceOutputSchema,
  insights,
  lookup,
  QlooClient,
  QlooError,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  rivalTypeOf,
  type SeenEntity,
  scoreRivalsOutputSchema,
  type ToolContext,
  tools,
  topicMapOutputSchema,
} from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const lead = 'Crime Junkie';
// Not a real show: stands in for a debut that Qloo does not know yet.
const debut = 'Zanzibar Quill Hour';
const comps = ['Serial', 'My Favorite Murder', 'Casefile'];
const rivals = ['Dateline NBC', '48 Hours'];
const cities = ['London', 'Lagos', 'New York', 'Johannesburg', 'Toronto'];

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
let rivalIds: string[] = [];

await step('Names: an established show, a debut, comparable shows and rivals', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: [lead, debut, ...comps, ...rivals],
    types: ['urn:entity:podcast'],
  });
  const out = resolveBundleOutputSchema.parse(data);
  for (const a of out.anchors) {
    console.log(`${a.name}: ${a.status}, popularity ${a.popularity ?? 'n/a'}`);
  }
  leadId = out.anchors.find((a) => a.name === lead)?.entityId ?? null;
  compIds = out.anchors.filter((a) => comps.includes(a.name)).flatMap((a) => a.entityId ?? []);
  rivalIds = out.anchors.filter((a) => rivals.includes(a.name)).flatMap((a) => a.entityId ?? []);
});

if (!leadId || compIds.length === 0) {
  console.log('The lead or the comps did not resolve, stopping.');
  process.exit(0);
}
const bundle = { 'signal.interests.entities': [leadId, ...compIds] };
const anchors = [leadId as string, ...compIds];

await step('Audience: age and gender rows for podcast anchors', async () => {
  const { data } = await tools.audienceBySegment.run(ctx, { entityIds: anchors });
  const out = audienceOutputSchema.parse(data);
  console.log(`${out.segments.length} of ${anchors.length} anchors have an age row`);
});

await step('Markets: heatmap cells for a podcast signal, with leave one out', async () => {
  const { data } = await tools.rankPlaces.run(ctx, { entityIds: anchors, places: cities });
  const out = rankPlacesOutputSchema.parse(data);
  console.log(
    out.places
      .map((p) => `${p.place} ${p.status} cells ${p.cells} lift ${p.lift?.toFixed(2) ?? 'n/a'}`)
      .join(' | '),
  );
  console.log(`leave one out: ${JSON.stringify(out.leaveOneOut)}`);
});

let genreTag: string | null = null;
await step('Tags: a podcast genre phrase in the media genre namespace', async () => {
  genreTag = await tag('true crime', ['urn:tag:genre:media']);
  await tag('comedy', ['urn:tag:genre:media']);
  await tag('business', ['urn:tag:genre:media']);
});

let discovered: string[] = [];
await step('Shows: what a podcast audience hears, with a genre tag and a city', async () => {
  if (!genreTag) {
    console.log('(no genre tag)');
    return;
  }
  for (const city of ['London', 'Lagos']) {
    const rows = await list(`podcasts + ${city}`, {
      'filter.type': 'urn:entity:podcast',
      ...bundle,
      'filter.tags': [genreTag],
      'signal.location.query': city,
      'filter.exclude.entities': anchors,
    });
    if (city === 'London') discovered = rows.map((r) => r.id);
  }
});

await step('Scoring: a candidate list of shows against the audience, in one call', async () => {
  const ids = [...new Set([...discovered, ...rivalIds])].slice(0, 8);
  if (ids.length === 0) {
    console.log('(no candidates)');
    return;
  }
  const { data } = await tools.scoreRivals.run(ctx, {
    entityIds: anchors,
    type: rivalTypeOf(['urn:entity:podcast']) ?? 'urn:entity:podcast',
    rivals: ids,
    leaveOneOut: false,
  });
  const out = scoreRivalsOutputSchema.parse(data);
  console.log(out.rivals.map((r) => `${r.name} ${r.overlap ?? 'n/a'}`).join(' | '));
});

await step('Topic map: the shape of /v2/analysis/compare for two groups of shows', async () => {
  const b = [...new Set([...rivalIds, ...discovered])].slice(0, 4);
  if (b.length === 0) {
    console.log('(no rivals)');
    return;
  }
  const { data } = await analysis.compare(qloo, { a: anchors, b, take: 20 });
  const names = (tags: { name: string; query?: { count?: string | number; score?: number } }[]) =>
    tags
      .slice(0, 6)
      .map((t) => `${t.name} (${t.query?.count ?? t.query?.score ?? 'n/a'})`)
      .join(' | ') || '(none)';
  console.log(`shared: ${names(data.results.tags)}`);
  console.log(`yours only: ${names(data.results.a)}`);
  console.log(`rivals only: ${names(data.results.b)}`);
  const run = await tools.topicMap.run(ctx, { entityIds: anchors, rivalIds: b });
  const out = topicMapOutputSchema.parse(run.data);
  console.log(
    `topicMap: yours ${out.yours.length}, shared ${out.shared.length}, rivals ${out.rivals.length}, confidence ${out.confidence}`,
  );
});

await step('Sponsors: brands a podcast audience uses', async () => {
  const beverage = await tag('beverage', ['urn:tag:genre:brand']);
  await list('brands', {
    'filter.type': 'urn:entity:brand',
    ...bundle,
    ...(beverage ? { 'filter.tags': [beverage] } : {}),
    'signal.location.query': 'London',
  });
});

await step('Crossover: artists and series a podcast audience follows', async () => {
  await list('artists', { 'filter.type': 'urn:entity:artist', ...bundle });
  await list('series', { 'filter.type': 'urn:entity:tv_show', ...bundle });
});

await step('Guests: whether Qloo returns people for a podcast signal', async () => {
  await list('people', { 'filter.type': 'urn:entity:person', ...bundle });
});

await step('A genre tag as the only signal, for a show Qloo does not know', async () => {
  if (!genreTag) {
    console.log('(no genre tag)');
    return;
  }
  const { data } = await insights.demographics(qloo, { 'signal.interests.tags': [genreTag] });
  console.log(`${data.results.demographics.length} demographics rows for the tag alone`);
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
