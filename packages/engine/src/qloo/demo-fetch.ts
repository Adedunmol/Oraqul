// Hand-written stand-in for Qloo, in the shape of the real responses. It is not Qloo data: ids
// start with DEMO- and receipts built from it carry `source: 'demo'`.

interface DemoEntity {
  id: string;
  name: string;
  type: string;
  popularity: number;
  age: Record<string, number>;
  gender: { male: number; female: number };
}

const bands = ['24_and_younger', '25_to_29', '30_to_34', '35_to_44', '45_to_54', '55_and_older'];

function ages(values: number[]): Record<string, number> {
  return Object.fromEntries(bands.map((band, i) => [band, values[i] ?? 0]));
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
];

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

/** Answers `/search` and demographics insights. Any other endpoint is a 404, as an unknown id would be. */
export const demoFetch: typeof fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.pathname === '/search') return search(url.searchParams);
  if (
    url.pathname === '/v2/insights' &&
    url.searchParams.get('filter.type') === 'urn:demographics'
  ) {
    return demographics(url.searchParams);
  }
  return json({ code: 404, reason: 'demo', message: `No demo data for ${url.pathname}` }, 404);
};
