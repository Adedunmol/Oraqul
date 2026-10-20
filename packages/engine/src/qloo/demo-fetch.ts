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
  /** What `/entities` returns under `properties`, such as a game's platforms. */
  properties?: Record<string, unknown>;
  /** Tag names by kind (`gameplay_type`, `emotional_tone`), returned as typed tags. */
  tagGroups?: Record<string, string[]>;
  /** Only shown to a signal that holds a game, so film and music demos keep their answers. */
  gameOnly?: boolean;
  /** Only shown to a signal that holds a podcast, so film, music and games demos keep their answers. */
  podcastOnly?: boolean;
  /** Found by name and scored, but never listed by an open discovery call. */
  searchOnly?: boolean;
}

const GAME = 'urn:entity:videogame';
const PODCAST = 'urn:entity:podcast';

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

const baseEntities: DemoEntity[] = [
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
    tags: ['roguelike'],
    properties: {
      platforms: ['PC (Windows)', 'Nintendo Switch'],
      genre: ['Action'],
      content_rating: 'T',
      developer: 'Cinder Works',
      universe: 'Ember',
    },
    tagGroups: { gameplay_type: ['Single-player'], emotional_tone: ['tense'] },
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

const gaming = ['video_games'];
const pc = 'PC (Windows)';

function demoGame(
  id: string,
  name: string,
  popularity: number,
  tags: string[],
  properties: Record<string, unknown>,
  tagGroups: Record<string, string[]>,
): DemoEntity {
  return {
    id,
    name,
    type: 'urn:entity:videogame',
    popularity,
    age: ages([0.35, 0.3, 0.05, -0.2, -0.4, -0.55]),
    gender: { male: 0.3, female: -0.3 },
    tags,
    properties,
    tagGroups,
  };
}

// Stand-ins for what each fan base of a game looks like. Not Qloo data.
const gameFanBase: DemoEntity[] = [
  demoGame(
    'DEMO-GAME-0002',
    'Hollow Hills',
    0.52,
    ['roguelike'],
    {
      platforms: [pc, 'Nintendo Switch'],
      genre: ['Action'],
      content_rating: 'T',
      developer: 'Cinder Works',
    },
    { gameplay_type: ['Single-player'], emotional_tone: ['tense'], player_mode: ['Single-player'] },
  ),
  demoGame(
    'DEMO-GAME-0003',
    'Crown of Ash',
    0.47,
    ['roguelike'],
    {
      platforms: [pc, 'PlayStation 5'],
      genre: ['Role-Playing'],
      content_rating: 'M',
      publisher: 'Gilt Tower',
    },
    {
      gameplay_type: ['Single-player'],
      emotional_tone: ['dark', 'epic'],
      player_mode: ['Single-player'],
    },
  ),
  demoGame(
    'DEMO-GAME-0004',
    'Tidewalker',
    0.31,
    ['cozy'],
    {
      platforms: [pc, 'Nintendo Switch', 'Xbox Series X/S'],
      genre: ['Adventure'],
      content_rating: 'E10+',
    },
    { gameplay_type: ['Single-player', 'Co-operative multiplayer'], emotional_tone: ['calm'] },
  ),
  demoGame(
    'DEMO-GAME-0005',
    'Void Courier',
    0.28,
    ['roguelike'],
    { platforms: ['iOS', 'Android'], genre: ['Strategy'], content_rating: 'T' },
    { gameplay_type: ['Single-player'], emotional_tone: ['tense'] },
  ),
  demoGame(
    'DEMO-GAME-0006',
    'Lantern Row',
    0.22,
    ['cozy'],
    { platforms: ['iOS', 'Android'], genre: ['Simulation'], content_rating: 'E' },
    { gameplay_type: ['Single-player'], emotional_tone: ['calm', 'humorous'] },
  ),
  // Well known games the Games agent falls back to for a short brief. Found by name only.
  ...(
    [
      ['DEMO-GAME-0201', 'Call of Duty: Mobile', 0.9],
      ['DEMO-GAME-0202', 'PUBG MOBILE', 0.88],
      ['DEMO-GAME-0203', 'Garena Free Fire', 0.85],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      ...demoGame(
        id,
        name,
        popularity,
        [],
        { platforms: ['iOS', 'Android'], genre: ['Shooter'], content_rating: 'T' },
        { gameplay_type: ['Online multiplayer'] },
      ),
      searchOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-MUSIC-0101', 'Pixel Choir', 0.44],
      ['DEMO-MUSIC-0102', 'Synthwave Kid', 0.37],
      ['DEMO-MUSIC-0103', 'Low Battery', 0.21],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:artist',
      popularity,
      age: young,
      gender: { male: 0.1, female: -0.1 },
      tags: ['synthwave'],
      gameOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-TV-0101', 'Kitsune Drift', 0.58, ['anime']],
      ['DEMO-TV-0102', 'Iron Sparrow', 0.4, ['anime']],
      ['DEMO-TV-0103', 'The Long Watch', 0.33, []],
    ] as const
  ).map(
    ([id, name, popularity, tags]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:tv_show',
      popularity,
      age: young,
      gender: { male: 0.15, female: -0.15 },
      tags: [...tags],
      gameOnly: true,
    }),
  ),
  {
    id: 'DEMO-FILM-0201',
    name: 'Ashfall',
    type: 'urn:entity:movie',
    popularity: 0.45,
    age: young,
    gender: { male: 0.2, female: -0.2 },
    gameOnly: true,
  },
  ...(
    [
      ['DEMO-POD-0101', 'Respawn Hour', 0.34],
      ['DEMO-POD-0102', 'Save Point', 0.26],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:podcast',
      popularity,
      age: young,
      gender: { male: 0.25, female: -0.25 },
      tags: gaming,
      gameOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-BRAND-0101', 'Voltage Energy', 0.5, 'beverage'],
      ['DEMO-BRAND-0102', 'Rival Gear', 0.36, 'peripherals'],
    ] as const
  ).map(
    ([id, name, popularity, tag]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:brand',
      popularity,
      age: young,
      gender: { male: 0.2, female: -0.2 },
      tags: [tag],
      gameOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-PERSON-0101', 'Nova Plays', 0.42],
      ['DEMO-PERSON-0102', 'Kenji Streams', 0.3],
      ['DEMO-PERSON-0103', 'Ola Speedruns', 0.18],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:person',
      popularity,
      age: young,
      gender: { male: 0.1, female: -0.1 },
      gameOnly: true,
    }),
  ),
];

const listeners = ages([0.1, 0.3, 0.25, 0, -0.2, -0.3]);
const everyGenre = [
  'true_crime',
  'comedy',
  'news',
  'business',
  'sports',
  'technology',
  'health',
  'music',
  'horror',
  'education',
  'tv_and_film',
];

// The audience of a podcast signal: shows like it, brands it uses, people and acts it follows. Only
// a podcast signal sees them, and base podcasts are never listed, so the other demos are unchanged.
const podcastFanBase: DemoEntity[] = [
  ...(
    [
      ['DEMO-POD-0201', 'Midnight Ledger', 0.38],
      ['DEMO-POD-0202', 'Case Closed Weekly', 0.31],
      ['DEMO-POD-0203', 'The Long Con', 0.27],
      ['DEMO-POD-0204', 'Dead Air', 0.22],
      ['DEMO-POD-0205', 'Second Draft', 0.17],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:podcast',
      popularity,
      age: listeners,
      gender: { male: -0.05, female: 0.05 },
      tags: everyGenre,
      podcastOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-BRAND-0201', 'Glide Mobile', 0.46, 'telecom'],
      ['DEMO-BRAND-0202', 'Fizz Cola', 0.41, 'beverage'],
      ['DEMO-BRAND-0203', 'Lumen Coffee', 0.28, 'beverage'],
      ['DEMO-BRAND-0204', 'Orbit Data', 0.24, 'telecom'],
    ] as const
  ).map(
    ([id, name, popularity, tag]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:brand',
      popularity,
      age: listeners,
      gender: { male: 0, female: 0 },
      tags: [tag],
      podcastOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-PERSON-0201', 'Ife Adeyemi', 0.33],
      ['DEMO-PERSON-0202', 'Marcus Holt', 0.25],
      ['DEMO-PERSON-0203', 'Tolu Bakare', 0.16],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:person',
      popularity,
      age: listeners,
      gender: { male: 0, female: 0 },
      podcastOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-ARTIST-0201', 'Zuri Vale', 0.4],
      ['DEMO-ARTIST-0202', 'The Night Shift', 0.3],
      ['DEMO-ARTIST-0203', 'Kemi Ode', 0.2],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:artist',
      popularity,
      age: listeners,
      gender: { male: 0, female: 0 },
      tags: ['afrobeats'],
      podcastOnly: true,
    }),
  ),
  ...(
    [
      ['DEMO-SHOW-0201', 'Harbour Lights', 0.36],
      ['DEMO-SHOW-0202', 'The Understudy', 0.27],
      ['DEMO-SHOW-0203', 'Quiet Hours', 0.19],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:tv_show',
      popularity,
      age: listeners,
      gender: { male: 0, female: 0 },
      podcastOnly: true,
    }),
  ),
  // Shows a brief or a fallback list can name. Found by name and scored, never listed.
  ...(
    [
      ['DEMO-POD-0211', 'SmartLess', 0.62],
      ['DEMO-POD-0212', 'The Daily', 0.7],
      ['DEMO-POD-0213', 'My Favorite Murder', 0.52],
      ['DEMO-POD-0214', 'Casefile', 0.4],
      ['DEMO-POD-0215', 'Armchair Expert', 0.55],
      ['DEMO-POD-0216', 'Call Her Daddy', 0.6],
      ['DEMO-POD-0217', 'How I Built This', 0.5],
      ['DEMO-POD-0218', 'Huberman Lab', 0.58],
      ['DEMO-POD-0219', 'Song Exploder', 0.35],
      ['DEMO-POD-0220', 'Planet Money', 0.5],
      ['DEMO-POD-0221', 'The Diary Of A CEO', 0.6],
      ['DEMO-POD-0222', 'Freakonomics Radio', 0.48],
      ['DEMO-POD-0223', 'Pod Save America', 0.55],
      ['DEMO-POD-0224', 'Up First', 0.58],
      ['DEMO-POD-0225', 'Today, Explained', 0.45],
      ['DEMO-POD-0226', 'The Rest Is Football', 0.5],
      ['DEMO-POD-0227', 'Pardon My Take', 0.46],
      ['DEMO-POD-0228', 'Hard Fork', 0.44],
      ['DEMO-POD-0229', 'Lex Fridman Podcast', 0.6],
      ['DEMO-POD-0230', 'On Purpose with Jay Shetty', 0.52],
      ['DEMO-POD-0231', 'Switched On Pop', 0.3],
      ['DEMO-POD-0232', 'Radiolab', 0.5],
      ['DEMO-POD-0233', 'Stuff You Should Know', 0.56],
    ] as const
  ).map(
    ([id, name, popularity]): DemoEntity => ({
      id,
      name,
      type: 'urn:entity:podcast',
      popularity,
      age: listeners,
      gender: { male: 0, female: 0 },
      tags: everyGenre,
      searchOnly: true,
    }),
  ),
];

export const demoEntities: DemoEntity[] = [...baseEntities, ...gameFanBase, ...podcastFanBase];

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

// Qloo's `/entities`: the entities for these ids, with the properties and typed tags a game has.
function entitiesById(params: URLSearchParams): Response {
  const wanted = params.get('entity_ids')?.split(',') ?? [];
  const results = demoEntities
    .filter((e) => wanted.includes(e.id))
    .map((e) => ({
      entity_id: e.id,
      name: e.name,
      types: [e.type],
      popularity: e.popularity,
      properties: e.properties ?? {},
      tags: Object.entries(e.tagGroups ?? {}).flatMap(([kind, names]) =>
        names.map((name) => ({ type: `urn:tag:${kind}:qloo`, name })),
      ),
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
  const heldTypes = signal.map((id) => demoEntities.find((e) => e.id === id)?.type);
  const aboutGames = heldTypes.includes(GAME);
  const aboutPodcasts = !aboutGames && heldTypes.includes(PODCAST);
  const results = demoEntities
    .filter((e) => e.type === params.get('filter.type'))
    .filter((e) => !e.searchOnly)
    .filter((e) => !e.gameOnly || aboutGames)
    .filter((e) => !e.podcastOnly || aboutPodcasts)
    .filter((e) => !aboutPodcasts || e.podcastOnly || e.type === 'urn:entity:place')
    .filter((e) => !aboutGames || e.gameOnly || e.type === GAME || e.type === 'urn:entity:place')
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

const demoTopics = [
  'Storytelling',
  'Interviews',
  'Humour',
  'True stories',
  'Diaspora life',
  'Money',
  'Relationships',
  'Technology',
  'Faith',
  'Politics',
];

// Each topic lands on your side, on the rivals' side or on both, by a hash of the two groups, the
// way `/v2/analysis/compare` splits tags. Counts are strings, as live (qloo.md).
function compared(params: URLSearchParams): Response {
  const a = params.get('a.signal.interests.entities') ?? '';
  const b = params.get('b.signal.interests.entities') ?? '';
  const tag = (name: string, query: object) => ({
    tag_id: `urn:tag:keyword:qloo:${name.toLowerCase().replace(/[^a-z]+/g, '_')}`,
    name,
    type: 'urn:tag',
    query,
  });
  const own: ReturnType<typeof tag>[] = [];
  const shared: ReturnType<typeof tag>[] = [];
  const rival: ReturnType<typeof tag>[] = [];
  for (const name of demoTopics) {
    const side = hashed(`${a}|${b}`, name);
    const count = String(1 + Math.floor(hashed(name, a) * 20));
    if (side < 0.4) own.push(tag(name, { count }));
    else if (side < 0.7) shared.push(tag(name, { score: Math.round(side * 100) / 100 }));
    else rival.push(tag(name, { count: String(1 + Math.floor(hashed(name, b) * 20)) }));
  }
  return json({ success: true, results: { tags: shared, a: own, b: rival } });
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
  if (url.pathname === '/entities') return entitiesById(url.searchParams);
  if (url.pathname === '/v2/analysis/compare') return compared(url.searchParams);
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
