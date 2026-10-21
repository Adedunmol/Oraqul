/**
 * Live check of the Books query catalog (docs/product/spec.md §4.5) on one brief: an established
 * literary novel with comparable books, planned for London and Lagos. It settles the Books
 * `TODO(verify)` items in docs/backend/qloo.md: whether a book works as an anchor, what a book
 * carries (publication year, tags), whether a book audience gives usable lists for books, series,
 * films, podcasts, brands and bookshops, whether heatmaps exist for a book signal, and which tag
 * namespace a book genre lives in.
 *
 *   pnpm --filter @oraqul/engine qloo:books-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing, because Qloo's terms on republishing responses are not confirmed. Copy conclusions
 * into the docs, not names or scores. About 100 calls.
 */
import {
  audienceOutputSchema,
  compareAudiencesOutputSchema,
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

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 220, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const lead = 'Half of a Yellow Sun';
// Not a real book: stands in for a debut that Qloo does not know yet.
const debut = 'Zanzibar Quill Orchard';
const comps = ['Americanah', 'Things Fall Apart', 'Purple Hibiscus'];
// Well known books by genre, to describe an audience with when a brief names none. Each is checked
// for an exact match, since Qloo often lists a book with its series ("Dune (Dune, #1)").
const fallbackNames = [
  'Normal People',
  'Where the Crawdads Sing',
  'The Seven Husbands of Evelyn Hugo',
  'Beach Read',
  'It Ends with Us',
  'Fourth Wing',
  'A Court of Thorns and Roses',
  'The Name of the Wind',
  'Gone Girl',
  'The Silent Patient',
  'The Girl on the Train',
  'Atomic Habits',
  'The Subtle Art of Not Giving a F*ck',
  'Sapiens',
  'Educated',
  'Becoming',
  'The Hunger Games',
  'Divergent',
  "Harry Potter and the Sorcerer's Stone",
  'Wonder',
  'Percy Jackson and the Lightning Thief',
  'Dune',
  'Project Hail Mary',
  'The Martian',
  'Pachinko',
  'Pride and Prejudice',
  'The Shining',
  'Things Fall Apart',
  'Born a Crime',
  'Rich Dad Poor Dad',
];
const screen = ['Normal People', 'Bridgerton'];
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

async function tag(
  query: string,
  types?: string[],
  parents?: 'urn:entity:brand'[],
): Promise<string | null> {
  const { data } = await lookup.tags(qloo, {
    'filter.query': query,
    ...(types ? { 'filter.tag.types': types } : {}),
    ...(parents ? { 'filter.parents.types': parents } : {}),
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

await step('Names: an established book, a debut, and comparable books', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: [lead, debut, ...comps],
    types: ['urn:entity:book'],
  });
  const out = resolveBundleOutputSchema.parse(data);
  for (const a of out.anchors) {
    console.log(`${a.name}: ${a.status}, popularity ${a.popularity ?? 'n/a'}`);
  }
  leadId = out.anchors.find((a) => a.name === lead)?.entityId ?? null;
  compIds = out.anchors.filter((a) => comps.includes(a.name)).flatMap((a) => a.entityId ?? []);
});

await step('Names: the fallback comps, found by exact name', async () => {
  for (let i = 0; i < fallbackNames.length; i += 8) {
    const { data } = await tools.resolveBundle.run(ctx, {
      names: fallbackNames.slice(i, i + 8),
      types: ['urn:entity:book'],
    });
    for (const a of resolveBundleOutputSchema.parse(data).anchors) {
      const top = a.candidates[0];
      console.log(
        `${a.name}: ${a.status}${a.status === 'found' ? '' : ` (nearest: ${top?.name ?? 'none'})`}`,
      );
    }
  }
});

if (!leadId || compIds.length === 0) {
  console.log('The lead or the comps did not resolve, stopping.');
  process.exit(0);
}
const bundle = { 'signal.interests.entities': [leadId, ...compIds] };
const anchors = [leadId as string, ...compIds];

await step('What a book carries: the fields /entities returns', async () => {
  const { data } = await lookup.entities(qloo, [leadId as string]);
  const e = data.results[0];
  const props = (e?.properties ?? {}) as Record<string, unknown>;
  console.log(`property keys: ${Object.keys(props).join(', ') || '(none)'}`);
  console.log(`publication_year: ${String(props.publication_year ?? 'n/a')}`);
  console.log(`tag types: ${[...new Set((e?.tags ?? []).map((t) => t.type ?? 'n/a'))].join(', ')}`);
  console.log(
    `tags: ${(e?.tags ?? [])
      .slice(0, 8)
      .map((t) => t.name)
      .join(' | ')}`,
  );
});

await step('Audience: age and gender rows for book anchors', async () => {
  const { data } = await tools.audienceBySegment.run(ctx, { entityIds: anchors });
  const out = audienceOutputSchema.parse(data);
  console.log(`${out.segments.length} of ${anchors.length} anchors have an age row`);
});

await step('Markets: heatmap cells for a book signal, with leave one out', async () => {
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
await step('Tags: a book genre phrase, in the media genre namespace and elsewhere', async () => {
  genreTag = await tag('literary fiction', ['urn:tag:genre:media']);
  await tag('romance', ['urn:tag:genre:media']);
  await tag('fantasy', ['urn:tag:genre:media']);
  await tag('thriller', ['urn:tag:genre:media']);
  await tag('children', ['urn:tag:genre:media']);
  await tag('literary fiction');
  await tag('romance');
});

let shelf: string[] = [];
await step('Shelf: books the audience reads, with a genre tag, a city and a year', async () => {
  const rows = await list('books + genre tag', {
    'filter.type': 'urn:entity:book',
    ...bundle,
    ...(genreTag ? { 'filter.tags': [genreTag] } : {}),
    'filter.exclude.entities': anchors,
  });
  shelf = rows.map((r) => r.id);
  await list('books + genre tag + since 2018', {
    'filter.type': 'urn:entity:book',
    ...bundle,
    ...(genreTag ? { 'filter.tags': [genreTag] } : {}),
    'filter.publication_year.min': 2018,
    'filter.exclude.entities': anchors,
  });
  await list('books + city (Lagos)', {
    'filter.type': 'urn:entity:book',
    ...bundle,
    'signal.location.query': 'Lagos',
    'filter.exclude.entities': anchors,
  });
  await list('books, no context', {
    'filter.type': 'urn:entity:book',
    ...bundle,
    'filter.exclude.entities': anchors,
  });
});

await step('Scoring: a candidate list of books against the audience, in one call', async () => {
  const ids = shelf.slice(0, 6);
  if (ids.length === 0) {
    console.log('(no candidates)');
    return;
  }
  const { data } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:book',
    ...bundle,
    'filter.results.entities': ids,
    take: 10,
  });
  console.log(
    data.results.entities.map((e) => `${e.name} ${e.query?.affinity ?? 'n/a'}`).join(' | '),
  );
});

await step('Bridge: series, films and podcasts a book audience follows', async () => {
  await list('series + since 2018', {
    'filter.type': 'urn:entity:tv_show',
    ...bundle,
    'filter.release_year.min': 2018,
  });
  await list('films + since 2018', {
    'filter.type': 'urn:entity:movie',
    ...bundle,
    'filter.release_year.min': 2018,
  });
  const podcastTag = await tag('books', ['urn:tag:genre:media']);
  await list('podcasts + books tag', {
    'filter.type': 'urn:entity:podcast',
    ...bundle,
    ...(podcastTag ? { 'filter.tags': [podcastTag] } : {}),
  });
  await list('podcasts, no tag', { 'filter.type': 'urn:entity:podcast', ...bundle });
});

await step('Screen comparisons: scoring named series and films in one call each', async () => {
  const found = resolveBundleOutputSchema.parse(
    (await tools.resolveBundle.run(ctx, { names: screen, types: ['urn:entity:tv_show'] })).data,
  );
  const ids = found.anchors.flatMap((a) =>
    a.status === 'found' && a.entityId ? [a.entityId] : [],
  );
  console.log(`series found: ${found.anchors.map((a) => `${a.name} ${a.status}`).join(' | ')}`);
  if (ids.length === 0) return;
  const { data } = await tools.compareAudiences.run(ctx, {
    entityIds: anchors,
    type: 'urn:entity:tv_show',
    rivals: ids,
    leaveOneOut: false,
  });
  console.log(
    compareAudiencesOutputSchema
      .parse(data)
      .rivals.map((r) => `${r.name} ${r.overlap ?? 'n/a'}`)
      .join(' | '),
  );
});

await step('Themes: theme and archetype tags on a book signal', async () => {
  for (const kind of ['theme', 'archetype', 'audience']) {
    const { data } = await insights.tags(qloo, {
      'signal.interests.entities': anchors,
      'filter.tag.types': [`urn:tag:${kind}:qloo`],
      take: 6,
    });
    console.log(`${kind}: ${data.results.tags.map((t) => t.name).join(' | ') || '(none)'}`);
  }
});

await step('Brands: a category and a city for a book audience', async () => {
  const beverage = await tag('beverage', ['urn:tag:genre:brand'], ['urn:entity:brand']);
  await list('brands', {
    'filter.type': 'urn:entity:brand',
    ...bundle,
    ...(beverage ? { 'filter.tags': [beverage] } : {}),
    'signal.location.query': 'London',
  });
});

await step('Bookshops, libraries and campuses: place categories per city', async () => {
  for (const phrase of ['book store', 'bookstore', 'library', 'university']) {
    await tag(phrase, ['urn:tag:category:place']);
  }
  const bookshop = await tag('book store', ['urn:tag:category:place']);
  if (bookshop) {
    for (const city of ['London', 'Lagos', 'New York']) {
      await list(`bookshops in ${city}`, {
        'filter.type': 'urn:entity:place',
        ...bundle,
        'filter.tags': [bookshop],
        'filter.location.query': city,
      });
    }
  }
});

await step('Creators: whether Qloo returns people for a book signal', async () => {
  await list('people', { 'filter.type': 'urn:entity:person', ...bundle });
});

await step('A genre tag as the only signal, for a book Qloo does not know', async () => {
  if (!genreTag) {
    console.log('(no genre tag)');
    return;
  }
  const { data } = await insights.demographics(qloo, { 'signal.interests.tags': [genreTag] });
  console.log(`${data.results.demographics.length} demographics rows for the tag alone`);
});

await step(
  'Bridge with context: series and films with a genre tag, a city and an age band',
  async () => {
    const drama = await tag('drama', ['urn:tag:genre:media']);
    const romance = await tag('romance', ['urn:tag:genre:media']);
    for (const [name, id] of [
      ['drama', drama],
      ['romance', romance],
    ] as const) {
      if (!id) continue;
      await list(`series + ${name} tag`, {
        'filter.type': 'urn:entity:tv_show',
        ...bundle,
        'filter.tags': [id],
        'filter.release_year.min': 2018,
      });
      await list(`series + ${name} tag + Lagos`, {
        'filter.type': 'urn:entity:tv_show',
        ...bundle,
        'filter.tags': [id],
        'signal.location.query': 'Lagos',
        'filter.release_year.min': 2018,
      });
      await list(`films + ${name} tag`, {
        'filter.type': 'urn:entity:movie',
        ...bundle,
        'filter.tags': [id],
        'filter.release_year.min': 2018,
      });
    }
    await tag('based on a book');
    await tag('adaptation');
  },
);

await step(
  'A second brief: a romantasy series, for the lists that may drift by genre',
  async () => {
    const { data } = await tools.resolveBundle.run(ctx, {
      names: ['Fourth Wing', 'A Court of Thorns and Roses', 'The Name of the Wind'],
      types: ['urn:entity:book'],
    });
    const out = resolveBundleOutputSchema.parse(data);
    console.log(out.anchors.map((a) => `${a.name} ${a.status}`).join(' | '));
    const ids = out.anchors.flatMap((a) => a.entityId ?? a.candidates[0]?.entityId ?? []);
    if (ids.length === 0) return;
    const signal = { 'signal.interests.entities': ids };
    const fantasy = await tag('fantasy romance', ['urn:tag:genre:media']);
    await list('books + fantasy romance', {
      'filter.type': 'urn:entity:book',
      ...signal,
      ...(fantasy ? { 'filter.tags': [fantasy] } : {}),
      'filter.exclude.entities': ids,
    });
    const drama = await tag('fantasy', ['urn:tag:genre:media']);
    await list('series + fantasy tag', {
      'filter.type': 'urn:entity:tv_show',
      ...signal,
      ...(drama ? { 'filter.tags': [drama] } : {}),
      'filter.release_year.min': 2018,
    });
    await list('series, no tag', {
      'filter.type': 'urn:entity:tv_show',
      ...signal,
      'filter.release_year.min': 2018,
    });
    await list('films, no tag', {
      'filter.type': 'urn:entity:movie',
      ...signal,
      'filter.release_year.min': 2018,
    });
    await list('people', { 'filter.type': 'urn:entity:person', ...signal });
    const { data: tags } = await insights.tags(qloo, {
      'signal.interests.entities': ids,
      'filter.tag.types': ['urn:tag:theme:qloo'],
      take: 6,
    });
    console.log(`theme: ${tags.results.tags.map((t) => t.name).join(' | ') || '(none)'}`);
  },
);

await step('Genre phrases a brief can use, in the media genre namespace', async () => {
  for (const phrase of [
    'young adult',
    'memoir',
    'self help',
    'business',
    'horror',
    'mystery',
    'poetry',
    'graphic novels',
    'biography',
    'crime',
    'science fiction',
    'historical fiction',
    'african literature',
    'cookbooks',
    'religion',
  ]) {
    await tag(phrase, ['urn:tag:genre:media']);
  }
});

const screenSeries = [
  'Normal People',
  'Conversations with Friends',
  'Little Fires Everywhere',
  "The Handmaid's Tale",
  'Bridgerton',
  'Virgin River',
  'Outlander',
  'Emily in Paris',
  'The Witcher',
  'Shadow and Bone',
  'The Wheel of Time',
  'House of the Dragon',
  'You',
  'Big Little Lies',
  'The Night Manager',
  'Sharp Objects',
  'Shrill',
  'The Last of Us',
  'Heartstopper',
  'Percy Jackson and the Olympians',
];
const screenFilms = [
  'Little Women',
  'Crazy Rich Asians',
  'Where the Crawdads Sing',
  'Dune',
  'The Hunger Games',
  'Gone Girl',
  'The Girl on the Train',
  'It Ends with Us',
  'Wonder',
  'Pride & Prejudice',
  'Normal People',
  'The Martian',
];
await step('Screen titles: exact names a bridge can score', async () => {
  for (const [types, names] of [
    [['urn:entity:tv_show'], screenSeries],
    [['urn:entity:movie'], screenFilms],
  ] as const) {
    for (let i = 0; i < names.length; i += 8) {
      const { data } = await tools.resolveBundle.run(ctx, {
        names: names.slice(i, i + 8),
        types: [...types],
      });
      for (const a of resolveBundleOutputSchema.parse(data).anchors) {
        console.log(
          `${types[0]?.slice(11)} ${a.name}: ${a.status}${a.status === 'found' ? '' : ` (nearest: ${a.candidates[0]?.name ?? 'none'})`}`,
        );
      }
    }
  }
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
