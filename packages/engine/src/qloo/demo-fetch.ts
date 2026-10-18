// Hand-written stand-in for Qloo, in the shape of the real responses. It is not Qloo data: ids
// start with DEMO- and receipts built from it carry `source: 'demo'`.

interface DemoEntity {
  id: string;
  name: string;
  type: string;
  popularity: number;
  age: Record<string, number>;
  gender: { male: number; female: number };
  /** Last segment of each tag urn the entity carries, such as `afrobeats`. */
  tags?: string[];
  /** Where a place is, matched against `filter.location.query`. */
  city?: string;
  /** Matched against `filter.release_country`. */
  country?: string;
}

const bands = ['24_and_younger', '25_to_29', '30_to_34', '35_to_44', '45_to_54', '55_and_older'];

function ages(values: number[]): Record<string, number> {
  return Object.fromEntries(bands.map((band, i) => [band, values[i] ?? 0]));
}

const flat = ages([0, 0, 0, 0, 0, 0]);
const young = ages([0.3, 0.2, 0.1, -0.1, -0.3, -0.4]);

function demoPlace(id: string, name: string, city: string, tag: string): DemoEntity {
  return {
    id,
    name,
    type: 'urn:entity:place',
    popularity: 0.5,
    age: flat,
    gender: { male: 0, female: 0 },
    tags: [tag],
    city,
  };
}

export const demoEntities: DemoEntity[] = [
  {
    id: 'DEMO-FILM-0001',
    name: 'Midnight Harbor',
    type: 'urn:entity:movie',
    popularity: 0.31,
    age: ages([0.27, 0.07, -0.21, -0.36, 0.13, -0.42]),
    gender: { male: 0.15, female: -0.15 },
  },
  {
    id: 'DEMO-FILM-0002',
    name: 'Midnight Harbor',
    type: 'urn:entity:tv_show',
    popularity: 0.22,
    age: ages([0.12, 0.31, 0.18, -0.1, -0.33, -0.5]),
    gender: { male: -0.05, female: 0.05 },
  },
  {
    id: 'DEMO-FILM-0003',
    name: 'Salt Road',
    type: 'urn:entity:movie',
    popularity: 0.44,
    age: ages([0.05, 0.22, 0.28, 0.1, -0.2, -0.38]),
    gender: { male: 0.02, female: -0.02 },
  },
  {
    id: 'DEMO-FILM-0004',
    name: 'The Glass Lantern',
    type: 'urn:entity:movie',
    popularity: 0.09,
    age: ages([0.2, 0.3, 0.16, -0.12, -0.3, -0.4]),
    gender: { male: 0.04, female: -0.04 },
  },
  {
    id: 'DEMO-BOOK-0001',
    name: 'The Glass Lantern',
    type: 'urn:entity:book',
    popularity: 0.18,
    age: ages([-0.1, 0.15, 0.34, 0.2, -0.05, -0.3]),
    gender: { male: -0.2, female: 0.2 },
  },
  {
    id: 'DEMO-MUSIC-0001',
    name: 'Neon Tide',
    type: 'urn:entity:artist',
    popularity: 0.27,
    age: ages([0.4, 0.25, -0.1, -0.35, -0.5, -0.6]),
    gender: { male: -0.08, female: 0.08 },
  },
  {
    id: 'DEMO-POD-0001',
    name: 'Late Signal',
    type: 'urn:entity:podcast',
    popularity: 0.12,
    age: ages([-0.2, 0.18, 0.3, 0.22, 0.0, -0.25]),
    gender: { male: 0.1, female: -0.1 },
  },
  {
    id: 'DEMO-GAME-0001',
    name: 'Ember Keep',
    type: 'urn:entity:videogame',
    popularity: 0.36,
    age: ages([0.35, 0.3, 0.05, -0.2, -0.4, -0.55]),
    gender: { male: 0.3, female: -0.3 },
  },
  {
    id: 'DEMO-FILM-0101',
    name: 'Avengers: Endgame',
    type: 'urn:entity:movie',
    popularity: 0.99,
    age: ages([0.2, 0.15, 0.1, 0, -0.1, -0.3]),
    gender: { male: 0.1, female: -0.1 },
  },
  {
    id: 'DEMO-FILM-0102',
    name: 'Top Gun: Maverick',
    type: 'urn:entity:movie',
    popularity: 0.99,
    age: ages([0, 0.05, 0.1, 0.15, 0.1, 0]),
    gender: { male: 0.2, female: -0.2 },
  },
  {
    id: 'DEMO-FILM-0103',
    name: 'Avatar: The Way of Water',
    type: 'urn:entity:movie',
    popularity: 0.98,
    age: ages([0.1, 0.1, 0.05, 0.05, 0, -0.1]),
    gender: { male: 0.05, female: -0.05 },
  },
  {
    id: 'DEMO-FILM-0104',
    name: 'Spider-Man: No Way Home',
    type: 'urn:entity:movie',
    popularity: 0.99,
    age: ages([0.3, 0.2, 0.05, -0.1, -0.3, -0.4]),
    gender: { male: 0.1, female: -0.1 },
  },
  {
    id: 'DEMO-FILM-0105',
    name: 'Harbor Lights',
    type: 'urn:entity:movie',
    country: 'Nigeria',
    popularity: 0.41,
    age: ages([0.25, 0.2, 0.1, -0.1, -0.2, -0.4]),
    gender: { male: 0.05, female: -0.05 },
  },
  {
    id: 'DEMO-FILM-0106',
    name: 'Third Mainland',
    type: 'urn:entity:movie',
    country: 'Nigeria',
    popularity: 0.35,
    age: ages([0.2, 0.25, 0.15, -0.05, -0.3, -0.45]),
    gender: { male: 0.1, female: -0.1 },
  },
  {
    id: 'DEMO-BRAND-0001',
    name: 'Coca-Cola',
    type: 'urn:entity:brand',
    popularity: 0.99,
    age: ages([0.05, 0.05, 0, 0, 0, -0.05]),
    gender: { male: 0, female: 0 },
  },
  {
    id: 'DEMO-BRAND-0002',
    name: 'Nike',
    type: 'urn:entity:brand',
    popularity: 0.99,
    age: ages([0.2, 0.1, 0, -0.05, -0.1, -0.2]),
    gender: { male: 0.05, female: -0.05 },
  },
  {
    id: 'DEMO-BRAND-0003',
    name: "McDonald's",
    type: 'urn:entity:brand',
    popularity: 0.98,
    age: ages([0.1, 0.05, 0, 0, -0.05, -0.1]),
    gender: { male: 0, female: 0 },
  },
  {
    id: 'DEMO-BRAND-0004',
    name: 'Night Market Cola',
    type: 'urn:entity:brand',
    tags: ['beverage'],
    popularity: 0.32,
    age: ages([0.3, 0.2, 0.05, -0.1, -0.3, -0.4]),
    gender: { male: -0.05, female: 0.05 },
  },
  {
    id: 'DEMO-BRAND-0005',
    name: 'Eko Threads',
    type: 'urn:entity:brand',
    tags: ['fashion'],
    popularity: 0.28,
    age: ages([0.35, 0.25, 0, -0.15, -0.35, -0.5]),
    gender: { male: -0.1, female: 0.1 },
  },
  {
    id: 'DEMO-POD-0002',
    name: 'The Joe Rogan Experience',
    type: 'urn:entity:podcast',
    popularity: 0.99,
    age: ages([0.1, 0.15, 0.1, 0.05, -0.1, -0.2]),
    gender: { male: 0.3, female: -0.3 },
  },
  {
    id: 'DEMO-POD-0003',
    name: 'Crime Junkie',
    type: 'urn:entity:podcast',
    tags: ['true_crime'],
    popularity: 1.0,
    age: ages([0.05, 0.1, 0.15, 0.05, -0.05, -0.15]),
    gender: { male: -0.3, female: 0.3 },
  },
  {
    id: 'DEMO-POD-0004',
    name: 'Serial',
    type: 'urn:entity:podcast',
    tags: ['true_crime'],
    popularity: 0.99,
    age: ages([0, 0.05, 0.1, 0.1, 0.05, -0.05]),
    gender: { male: -0.1, female: 0.1 },
  },
  {
    id: 'DEMO-POD-0005',
    name: 'Lagos After Dark',
    type: 'urn:entity:podcast',
    popularity: 0.22,
    age: ages([0.3, 0.25, 0.1, -0.1, -0.3, -0.5]),
    gender: { male: 0, female: 0 },
  },
  ...(
    [
      ['DEMO-MUSIC-0002', 'Ada Lux', 0.61],
      ['DEMO-MUSIC-0003', 'Kola Wave', 0.48],
      ['DEMO-MUSIC-0004', 'Sade Rhythm', 0.35],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:artist',
      popularity,
      age: young,
      gender: { male: 0, female: 0 },
      tags: ['afrobeats'],
    }),
  ),
  ...(
    [
      ['DEMO-TV-0001', 'Harbor Precinct', 0.42],
      ['DEMO-TV-0002', 'Eko Nights', 0.28],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:tv_show',
      popularity,
      age: young,
      gender: { male: 0, female: 0 },
    }),
  ),
  {
    id: 'DEMO-BRAND-0006',
    name: 'Lagoon Mobile',
    type: 'urn:entity:brand',
    popularity: 0.4,
    age: flat,
    gender: { male: 0, female: 0 },
    tags: ['telecom'],
  },
  demoPlace('DEMO-PLACE-0001', 'Marina Picturehouse', 'Lagos', 'movie_theater'),
  demoPlace('DEMO-PLACE-0002', 'Lekki Screens', 'Lagos', 'movie_theater'),
  demoPlace('DEMO-PLACE-0003', 'Southbank Screen', 'London', 'movie_theater'),
  demoPlace('DEMO-PLACE-0004', 'Bayou Cinema', 'Houston', 'movie_theater'),
  demoPlace('DEMO-PLACE-0005', 'Peachtree Pictures', 'Atlanta', 'movie_theater'),
  demoPlace('DEMO-PLACE-0006', 'Grace Chapel Houston', 'Houston', 'church'),
  demoPlace('DEMO-PLACE-0007', 'Pentecost House', 'London', 'church'),
  demoPlace('DEMO-PLACE-0008', 'Gulf Coast University', 'Houston', 'university'),
  demoPlace('DEMO-PLACE-0009', 'Lagoon City University', 'Lagos', 'university'),
];

const demoTagNames: Record<string, string[]> = {
  theme: ['Ambition', 'Family', 'Power', 'Loyalty', 'Survival', 'Community'],
  archetype: ['The Matriarch', 'The Rival', 'The Outsider', 'The Fixer'],
  audience: ['Drama Fans', 'Action Seekers', 'Stylish', 'Resilient'],
  plot: ['Bold', 'Timely', 'Tense', 'Lively'],
};

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function search(params: URLSearchParams): Response {
  const query = (params.get('query') ?? '').toLowerCase();
  const types = params.get('types')?.split(',');
  const results = demoEntities
    .filter((e) => e.name.toLowerCase().includes(query))
    .filter((e) => !types || types.includes(e.type))
    .map((e) => ({
      entity_id: e.id,
      name: e.name,
      types: [e.type],
      popularity: e.popularity,
    }));
  return json({ success: true, results });
}

function demographics(params: URLSearchParams): Response {
  const wanted = params.get('signal.interests.entities')?.split(',') ?? [];
  const demographicsRows = demoEntities
    .filter((e) => wanted.includes(e.id))
    .map((e) => ({ entity_id: e.id, query: { age: e.age, gender: e.gender } }));
  return json({ success: true, results: { demographics: demographicsRows } });
}

// A stable number from 0 to 1 for a pair of strings, so demo answers repeat.
function hashed(a: string, b: string): number {
  let h = 2166136261;
  for (const ch of `${a}|${b}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967295;
}

function signalOf(params: URLSearchParams): string[] {
  return params.get('signal.interests.entities')?.split(',') ?? [];
}

const CELLS_PER_BOX = 120;

function heatmap(params: URLSearchParams): Response {
  const signal = signalOf(params);
  const rings = [...(params.get('filter.location') ?? '').matchAll(/\(\(([^()]+)\)\)/g)];
  const cells = rings.flatMap(([, ring]) => {
    const points = (ring ?? '').split(',').map((p) => p.trim().split(/\s+/).map(Number));
    const lons = points.map((p) => p[0] ?? 0);
    const lats = points.map((p) => p[1] ?? 0);
    const [west, east, south, north] = [
      Math.min(...lons),
      Math.max(...lons),
      Math.min(...lats),
      Math.max(...lats),
    ];
    const key = `${west.toFixed(2)},${south.toFixed(2)}`;
    const base = signal.reduce((sum, id) => sum + hashed(id, key), 0) / (signal.length || 1);
    return Array.from({ length: CELLS_PER_BOX }, (_, i) => ({
      location: {
        latitude: south + ((north - south) * ((i % 12) + 0.5)) / 12,
        longitude: west + ((east - west) * (Math.floor(i / 12) + 0.5)) / 10,
        geohash: `demo${key}${i}`,
      },
      query: {
        affinity: 0.3 + 0.6 * base + 0.01 * hashed(key, String(i)),
        affinity_rank: i + 1,
        popularity: hashed(key, `p${i}`),
      },
    }));
  });
  return json({ success: true, results: { heatmap: cells } });
}

// Scores the requested demo entities against the signal, as `filter.results.entities` does.
function scored(params: URLSearchParams): Response {
  const signal = signalOf(params);
  const wanted = params.get('filter.results.entities')?.split(',') ?? [];
  const results = demoEntities
    .filter((e) => wanted.includes(e.id))
    .map((e) => ({
      entity_id: e.id,
      name: e.name,
      subtype: e.type,
      popularity: e.popularity,
      query: {
        affinity:
          0.3 +
          (0.6 * signal.reduce((sum, id) => sum + hashed(id, e.id), 0)) / (signal.length || 1),
      },
    }));
  return json({ success: true, results: { entities: results } });
}

function discovered(params: URLSearchParams): Response {
  const signal = signalOf(params);
  const excluded = params.get('filter.exclude.entities')?.split(',') ?? [];
  const take = Number(params.get('take') ?? 20);
  const tags = params.get('filter.tags')?.split(',') ?? [];
  const city = params.get('filter.location.query')?.toLowerCase();
  const country = params.get('filter.release_country')?.toLowerCase();
  const results = demoEntities
    .filter((e) => e.type === params.get('filter.type'))
    .filter((e) => !signal.includes(e.id) && !excluded.includes(e.id))
    .filter((e) => tags.every((t) => e.tags?.includes(t.split(':').at(-1) ?? '')))
    .filter((e) => !city || e.city?.toLowerCase() === city)
    .filter((e) => !country || e.country?.toLowerCase() === country)
    .map((e) => ({
      entity_id: e.id,
      name: e.name,
      subtype: e.type,
      popularity: e.popularity,
      query: {
        affinity:
          0.3 +
          (0.6 * signal.reduce((sum, id) => sum + hashed(id, e.id), 0)) / (signal.length || 1),
      },
    }))
    .sort((a, b) => b.query.affinity - a.query.affinity)
    .slice(0, take);
  return json({ success: true, results: { entities: results } });
}

// Live, a phrase returns one tag per namespace (qloo.md), so the demo does the same.
const tagNamespaces = [
  'urn:tag:genre:music',
  'urn:tag:genre:media',
  'urn:tag:category:place',
  'urn:tag:genre:brand',
  'urn:tag:keyword:qloo',
];

function tagLookup(params: URLSearchParams): Response {
  const phrase = (params.get('filter.query') ?? '').trim().toLowerCase();
  const slug = phrase.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const brandOnly = params.get('filter.parents.types')?.includes('urn:entity:brand');
  const tags = slug
    ? tagNamespaces
        .filter((ns) => !brandOnly || ns === 'urn:tag:genre:brand')
        .map((ns) => ({ id: `${ns}:${slug}`, name: phrase, type: ns }))
    : [];
  return json({ success: true, results: { tags } });
}

function tagInsights(params: URLSearchParams): Response {
  const kind = params.get('filter.tag.types')?.match(/^urn:tag:([a-z_]+):qloo$/)?.[1] ?? '';
  const signal = signalOf(params);
  const take = Number(params.get('take') ?? 20);
  const tags = (demoTagNames[kind] ?? [])
    .map((name) => ({
      tag_id: `urn:tag:${kind}:qloo:${name.toLowerCase().replace(/[^a-z]+/g, '_')}`,
      name,
      type: 'urn:tag',
      subtype: `urn:tag:${kind}:qloo`,
      query: {
        affinity: signal.reduce((sum, id) => sum + hashed(id, name), 0) / (signal.length || 1),
      },
    }))
    .sort((a, b) => b.query.affinity - a.query.affinity)
    .slice(0, take);
  return json({ success: true, results: { tags } });
}

/**
 * Answers `/search`, `/v2/tags`, demographics, heatmap, tag insights, candidate scoring and
 * open-ended entity insights.
 */
export const demoFetch: typeof fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.pathname === '/search') return search(url.searchParams);
  if (url.pathname === '/v2/tags') return tagLookup(url.searchParams);
  const type = url.searchParams.get('filter.type');
  if (url.pathname === '/v2/insights' && type === 'urn:demographics') {
    return demographics(url.searchParams);
  }
  if (url.pathname === '/v2/insights' && type === 'urn:heatmap') return heatmap(url.searchParams);
  if (url.pathname === '/v2/insights' && type === 'urn:tag') return tagInsights(url.searchParams);
  if (url.pathname === '/v2/insights' && url.searchParams.has('filter.results.entities')) {
    return scored(url.searchParams);
  }
  if (url.pathname === '/v2/insights' && type?.startsWith('urn:entity:')) {
    return discovered(url.searchParams);
  }
  return json({ code: 404, reason: 'demo', message: `No demo data for ${url.pathname}` }, 404);
};
