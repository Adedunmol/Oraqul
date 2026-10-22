import type { FanMedium, LaunchModuleKey, LaunchSectionKey } from '@oraqul/schema';
import type { LaunchKind } from './modules';

// The Games query catalog (spec §4.3). The model picks from these and fills in their context; code
// runs them, within the call budget, and turns each result into a finding.
// Game signals are checked live for every query below, with `qloo-games-probes.ts`
// (docs/backend/qloo.md).

export const gamesQueryKeys = [
  'audience',
  'markets',
  'profile',
  'fanbase',
  'tags',
  'brands',
  'podcasts',
  'creators',
  'community',
] as const;
export type GamesQueryKey = (typeof gamesQueryKeys)[number];

export interface GamesQuerySpec {
  key: GamesQueryKey;
  /** `core` queries run for every plan; the others only when their module is in it. */
  for: 'core' | LaunchModuleKey;
  /** Sections whose lines usually cite it. Any line may cite any finding. */
  feeds: LaunchSectionKey[];
  /** For the chat trace, as "Asking Qloo about …". */
  label: string;
}

export const GAMES_QUERIES: Record<GamesQueryKey, GamesQuerySpec> = {
  audience: {
    key: 'audience',
    for: 'core',
    feeds: ['audience', 'bottom-line'],
    label: "the game's audience by age and gender",
  },
  markets: {
    key: 'markets',
    for: 'core',
    feeds: ['markets', 'bottom-line'],
    label: 'where in your regions that audience is strongest',
  },
  profile: {
    key: 'profile',
    for: 'core',
    feeds: ['positioning', 'store'],
    label: 'the platforms, genres and age ratings of your comparable games',
  },
  fanbase: {
    key: 'fanbase',
    for: 'collabs',
    feeds: ['collabs', 'audience', 'bottom-line'],
    label: 'the music, series, films, brands, podcasts and games that audience follows',
  },
  tags: {
    key: 'tags',
    for: 'store',
    feeds: ['store', 'positioning'],
    label: 'the themes and traits that describe your comparable games',
  },
  brands: {
    key: 'brands',
    for: 'partnerships',
    feeds: ['partnerships'],
    label: 'the brands that audience uses',
  },
  podcasts: {
    key: 'podcasts',
    for: 'publicity',
    feeds: ['publicity'],
    label: 'the gaming podcasts that audience hears',
  },
  creators: {
    key: 'creators',
    for: 'creators',
    feeds: ['creators'],
    label: 'the creators that audience follows',
  },
  community: {
    key: 'community',
    for: 'community',
    feeds: ['community'],
    label: 'the campuses where that audience gathers',
  },
};

/** One fan base the bridge ranks: what Qloo type it is, and the tag that narrows it, if any. */
export interface FanMediumSpec {
  medium: FanMedium;
  type:
    | 'urn:entity:artist'
    | 'urn:entity:tv_show'
    | 'urn:entity:movie'
    | 'urn:entity:brand'
    | 'urn:entity:podcast'
    | 'urn:entity:videogame';
  /** A phrase that must resolve into the namespace in `TAG_SPACES`; null for no tag. */
  phrase: string | null;
  /** The key into `TAG_SPACES` the phrase resolves in. */
  space: keyof typeof TAG_SPACES | null;
  /** Shown in the bridge as "Series: …". */
  label: string;
}

export const FAN_MEDIA: readonly FanMediumSpec[] = [
  { medium: 'music', type: 'urn:entity:artist', phrase: null, space: null, label: 'Music' },
  { medium: 'series', type: 'urn:entity:tv_show', phrase: null, space: null, label: 'Series' },
  { medium: 'anime', type: 'urn:entity:tv_show', phrase: 'anime', space: 'anime', label: 'Anime' },
  { medium: 'film', type: 'urn:entity:movie', phrase: null, space: null, label: 'Film' },
  { medium: 'brand', type: 'urn:entity:brand', phrase: null, space: null, label: 'Brand' },
  {
    medium: 'podcast',
    type: 'urn:entity:podcast',
    phrase: 'video games',
    space: 'podcasts',
    label: 'Podcast',
  },
  { medium: 'game', type: 'urn:entity:videogame', phrase: null, space: null, label: 'Game' },
];

/** Tag namespaces each query's phrases must resolve into, and the parent type for brands. */
export const TAG_SPACES = {
  // Verified live: a game genre phrase ("roguelike") resolves to `urn:tag:genre:media:<genre>`.
  gameGenre: { prefix: 'urn:tag:genre:media', parent: 'urn:entity:videogame' },
  anime: { prefix: 'urn:tag:genre:media', parent: null },
  podcasts: { prefix: 'urn:tag:genre:media', parent: null },
  brands: { prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
  community: { prefix: 'urn:tag:category:place', parent: null },
} as const;

/** Brand categories asked for a game: what its audience buys around play. */
export const GAMES_BRAND_CATEGORIES = ['beverage', 'telecom'];

/** Universities are where a games audience gathers that Qloo can place. */
export const GAMES_COMMUNITY_PLACES = ['university'];

/**
 * Well known games to describe an audience with when the brief names none and the model proposes
 * none, so a short description is enough to plan from. The first rule whose words match the brief
 * and whose kinds include the launch kind wins; the last rule of each kind is its default. Qloo
 * finds each by name, or stands in the nearest game it has, and the plan labels them as added by
 * Oraqul. Each name was checked on the live host: the ones with no match or a wrong one were
 * replaced, and a few resolve to a longer official title (the nearest match is used).
 */
export const FALLBACK_COMPS: {
  match: RegExp;
  kinds?: readonly LaunchKind[];
  names: readonly string[];
}[] = [
  {
    match: /shoot|\bfps\b|battle royale|\bgun/i,
    kinds: ['mobile'],
    names: [
      'Call of Duty Mobile',
      'PUBG MOBILE',
      'Garena Free Fire',
      'Critical Ops',
      'Brawl Stars',
    ],
  },
  {
    match: /shoot|\bfps\b|battle royale|\bgun/i,
    names: ['Call of Duty: Warzone', 'Apex Legends', 'Counter-Strike 2', 'Fortnite', 'Valorant'],
  },
  {
    match: /football|soccer|sport/i,
    names: ['eFootball', 'EA SPORTS FC 24', 'Football Manager 2024', 'NBA 2K24'],
  },
  {
    match: /racing|driving|\bcar\b/i,
    names: [
      'Asphalt 9: Legends',
      'Forza Horizon 5',
      'Need for Speed Unbound',
      'Mario Kart 8 Deluxe',
      'Gran Turismo 7',
    ],
  },
  {
    match: /roguelike|roguelite|deck-?build|metroidvania|souls-?like/i,
    names: ['Hades', 'Dead Cells', 'Slay the Spire', 'Hollow Knight', 'Vampire Survivors'],
  },
  {
    match: /cozy|farming|simulation|\bsim\b|life|village/i,
    names: [
      'Stardew Valley',
      'Animal Crossing: New Horizons',
      'Unpacking',
      'Disney Dreamlight Valley',
      'Coral Island',
    ],
  },
  {
    match: /puzzle|match|word|trivia/i,
    names: ['Candy Crush Saga', 'Monument Valley', 'Wordle'],
  },
  {
    match: /strategy|tower defen[cs]e|4x|\bwar\b|kingdom|empire/i,
    names: [
      'Clash of Clans',
      'Clash Royale',
      "Sid Meier's Civilization VI",
      'Bloons TD 6',
      'Plants vs. Zombies',
    ],
  },
  {
    match: /horror|scary|survival/i,
    names: [
      'Resident Evil 4',
      'Dead by Daylight',
      "Five Nights at Freddy's",
      'Phasmophobia',
      'Subnautica',
    ],
  },
  {
    match:
      /fight|brawl|martial|combat|action|adventure|rpg|role-?play|open world|story|myth|folklore|warrior/i,
    names: [
      'Elden Ring',
      'God of War',
      'Genshin Impact',
      'The Witcher 3: Wild Hunt',
      'Black Myth: Wukong',
    ],
  },
  {
    match: /./,
    kinds: ['mobile'],
    names: [
      'Subway Surfers',
      'Candy Crush Saga',
      'Clash of Clans',
      'Call of Duty Mobile',
      'Among Us',
    ],
  },
  {
    match: /./,
    kinds: ['free_to_play'],
    names: ['Fortnite', 'Genshin Impact', 'League of Legends', 'Apex Legends', 'Roblox'],
  },
  {
    match: /./,
    names: ['Elden Ring', 'Hades', 'Stardew Valley', 'Celeste', "Baldur's Gate 3"],
  },
];

/** Games to describe the audience with, from what the brief says about the game and its kind. */
export function fallbackComps(words: string, kind: LaunchKind, max = 4): string[] {
  const rule = FALLBACK_COMPS.find(
    (r) => r.match.test(words) && (!r.kinds || r.kinds.includes(kind)),
  );
  return (rule?.names ?? []).slice(0, max);
}

/** Fan bases a bridge shows per medium, best first. */
export const FAN_BASES_PER_MEDIUM = 2;

/**
 * Whether Qloo's `person` type returns streamers and YouTubers for a game signal. False until
 * probe 7 of `qloo-games-probes.ts` says so and docs/backend/qloo.md records it. While false, the
 * Creators section is playbook and says Qloo has no creator data.
 */
export const CREATORS_GROUNDED = false;

/**
 * The table cities a region word stands for, so a brief that says "Europe and Southeast Asia" gets
 * cities Qloo can rank. Keys are lower case.
 */
export const REGION_CITIES: Record<string, readonly string[]> = {
  'north america': ['Los Angeles', 'New York', 'Toronto'],
  us: ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  usa: ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  'united states': ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  america: ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  canada: ['Toronto', 'Vancouver'],
  mexico: ['Mexico City'],
  'latin america': ['São Paulo', 'Mexico City'],
  brazil: ['São Paulo'],
  europe: ['London', 'Berlin', 'Paris', 'Stockholm', 'Warsaw'],
  uk: ['London', 'Manchester'],
  'united kingdom': ['London', 'Manchester'],
  germany: ['Berlin'],
  france: ['Paris'],
  spain: ['Madrid'],
  poland: ['Warsaw'],
  nordics: ['Stockholm'],
  sweden: ['Stockholm'],
  asia: ['Tokyo', 'Seoul', 'Singapore', 'Mumbai'],
  'east asia': ['Tokyo', 'Seoul'],
  japan: ['Tokyo'],
  korea: ['Seoul'],
  'south korea': ['Seoul'],
  'southeast asia': ['Singapore', 'Manila', 'Jakarta'],
  philippines: ['Manila'],
  indonesia: ['Jakarta'],
  singapore: ['Singapore'],
  india: ['Mumbai', 'Delhi'],
  africa: ['Lagos', 'Johannesburg', 'Nairobi', 'Cairo'],
  nigeria: ['Lagos', 'Abuja'],
  'south africa': ['Johannesburg', 'Cape Town'],
  kenya: ['Nairobi'],
  oceania: ['Sydney', 'Auckland'],
  australia: ['Sydney'],
  'new zealand': ['Auckland'],
};

/** Table cities for the region words in a brief, in the order named, without repeats. */
export function citiesForRegions(words: readonly string[], max = 8): string[] {
  const cities = words.flatMap((w) => REGION_CITIES[w.trim().toLowerCase()] ?? []);
  return [...new Set(cities)].slice(0, max);
}
