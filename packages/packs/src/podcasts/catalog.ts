import type { LaunchModuleKey, LaunchSectionKey } from '@oraqul/schema';

// The Podcasts query catalog (spec §4.4). The model picks from these and fills in their context;
// code runs them, within the call budget, and turns each result into a finding.
// TODO(verify): podcast signals on the live host for every query below, with
// `qloo-podcasts-probes.ts`. Until docs/backend/qloo.md says so, none of these is verified for
// Podcasts.

export const podcastsQueryKeys = [
  'audience',
  'markets',
  'topics',
  'crosspromo',
  'brands',
  'guests',
  'crossover',
] as const;
export type PodcastsQueryKey = (typeof podcastsQueryKeys)[number];

export interface PodcastsQuerySpec {
  key: PodcastsQueryKey;
  /** `core` queries run for every plan; the others only when their module is in it. */
  for: 'core' | LaunchModuleKey;
  /** Sections whose lines usually cite it. Any line may cite any finding. */
  feeds: LaunchSectionKey[];
  /** For the chat trace, as "Asking Qloo about …". */
  label: string;
}

export const PODCASTS_QUERIES: Record<PodcastsQueryKey, PodcastsQuerySpec> = {
  audience: {
    key: 'audience',
    for: 'core',
    feeds: ['audience', 'bottom-line'],
    label: "the show's audience by age and gender",
  },
  markets: {
    key: 'markets',
    for: 'core',
    feeds: ['markets', 'bottom-line', 'live'],
    label: 'where in your markets that audience is strongest',
  },
  topics: {
    key: 'topics',
    for: 'core',
    feeds: ['positioning', 'bottom-line'],
    label: 'the topics your audience likes that rival shows do not own',
  },
  crosspromo: {
    key: 'crosspromo',
    for: 'crosspromo',
    feeds: ['crosspromo', 'bottom-line'],
    label: 'the shows that audience already listens to',
  },
  brands: {
    key: 'brands',
    for: 'partnerships',
    feeds: ['partnerships'],
    label: 'the brands that audience uses',
  },
  guests: {
    key: 'guests',
    for: 'guests',
    feeds: ['guests'],
    label: 'the people that audience follows',
  },
  crossover: {
    key: 'crossover',
    for: 'publicity',
    feeds: ['publicity', 'video'],
    label: 'the artists and series that audience follows, for episode angles',
  },
};

/** Tag namespaces each query's phrases must resolve into, and the parent type for brands. */
export const TAG_SPACES = {
  // TODO(verify): that a podcast genre phrase resolves into `urn:tag:genre:media`, which the film
  // and games probes found for true crime and video games.
  podcastGenre: { prefix: 'urn:tag:genre:media', parent: null },
  brands: { prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
  artists: { prefix: 'urn:tag:genre:music', parent: null },
} as const;

/** A podcast genre phrase by the words a brief uses for the show. No match means no genre tag. */
export const GENRE_PHRASES: { match: RegExp; phrase: string }[] = [
  {
    match: /true[- ]crime|\bcrime\b|murder|investigat\w*|detective|cold case/i,
    phrase: 'true crime',
  },
  { match: /comed(y|ian)|funny|humou?r|banter|sketch/i, phrase: 'comedy' },
  { match: /\bnews\b|politic\w*|current affairs|daily briefing|explainer/i, phrase: 'news' },
  { match: /business|entrepreneur|startup|finance|money|invest\w*|career/i, phrase: 'business' },
  { match: /football|soccer|sport|basketball|nba|athlet\w*/i, phrase: 'sports' },
  { match: /tech|\bai\b|software|gadgets?|crypto/i, phrase: 'technology' },
  { match: /health|wellness|fitness|mental|therapy|self[- ]help|mindset/i, phrase: 'health' },
  { match: /music|album|songwriting|hip[- ]hop|afrobeats/i, phrase: 'music' },
  { match: /horror|scary|paranormal|ghost/i, phrase: 'horror' },
  { match: /histor\w*|documentar\w*|science|education\w*|learn\w*/i, phrase: 'education' },
  { match: /film|movie|tv\b|series|pop culture|celebrit\w*|entertainment/i, phrase: 'tv and film' },
];

/** The genre phrase for the words in a brief, or null. */
export function genrePhrase(words: string): string | null {
  return GENRE_PHRASES.find((g) => g.match.test(words))?.phrase ?? null;
}

/** Brand categories asked for a show: the verified ones that give brands that operate in a city. */
export const PODCASTS_BRAND_CATEGORIES = ['beverage', 'telecom'];

/**
 * Well known shows to describe an audience with when the brief names none and the model proposes
 * none, so a short description is enough to plan from. The first rule whose words match the brief
 * wins; the last rule is the default. Qloo finds each by name, or stands in the nearest show it
 * has, and the plan labels them as added by Oraqul. TODO(verify): that each name resolves to one
 * exact match on the live host.
 */
export const FALLBACK_COMPS: { match: RegExp; names: readonly string[] }[] = [
  {
    match: /true[- ]crime|\bcrime\b|murder|investigat\w*|detective|cold case/i,
    names: ['Crime Junkie', 'Serial', 'My Favorite Murder', 'Casefile'],
  },
  {
    match: /comed(y|ian)|funny|humou?r|banter|sketch/i,
    names: ['SmartLess', 'Conan O’Brien Needs a Friend', 'Call Her Daddy', 'Armchair Expert'],
  },
  {
    match: /\bnews\b|politic\w*|current affairs|daily briefing|explainer/i,
    names: ['The Daily', 'Pod Save America', 'Up First', 'Today, Explained'],
  },
  {
    match: /business|entrepreneur|startup|finance|money|invest\w*|career/i,
    names: ['How I Built This', 'Planet Money', 'The Diary Of A CEO', 'Freakonomics Radio'],
  },
  {
    match: /football|soccer|sport|basketball|nba|athlet\w*/i,
    names: ['The Rest Is Football', 'Pardon My Take', 'The Bill Simmons Podcast', 'Men in Blazers'],
  },
  {
    match: /tech|\bai\b|software|gadgets?|crypto/i,
    names: ['Hard Fork', 'Lex Fridman Podcast', 'Acquired', 'All-In'],
  },
  {
    match: /health|wellness|fitness|mental|therapy|self[- ]help|mindset/i,
    names: [
      'Huberman Lab',
      'On Purpose with Jay Shetty',
      'The Mel Robbins Podcast',
      'The Tim Ferriss Show',
    ],
  },
  {
    match: /music|album|songwriting|hip[- ]hop|afrobeats/i,
    names: ['Song Exploder', 'Switched On Pop', 'Dissect', 'Broken Record'],
  },
  {
    match: /histor\w*|documentar\w*|science|education\w*|learn\w*/i,
    names: ['Radiolab', 'Hardcore History', 'Stuff You Should Know', 'Revisionist History'],
  },
  {
    match: /./,
    names: ['The Joe Rogan Experience', 'Crime Junkie', 'SmartLess', 'The Daily'],
  },
];

/** Shows to describe the audience with, from what the brief says about the show. */
export function fallbackComps(words: string, max = 4): string[] {
  const rule = FALLBACK_COMPS.find((r) => r.match.test(words));
  return (rule?.names ?? []).slice(0, max);
}

/** Shows a cross promotion list ranks, best first. */
export const CROSS_PROMO_SHOWS = 4;

/** Rival shows a topic map compares the audience with, at most. */
export const TOPIC_RIVALS = 4;

/** Topics a topic map keeps on each side, at most. */
export const TOPICS_SHOWN = 8;

/**
 * Whether Qloo's `person` type returns hosts and guests for a podcast signal. False until probe 7
 * of `qloo-podcasts-probes.ts` says so and docs/backend/qloo.md records it. While false, the
 * Guests section is playbook and says Qloo has no guest data.
 */
export const GUESTS_GROUNDED = false;

/**
 * The table cities a region word stands for, so a brief that says "Europe and West Africa" gets
 * cities Qloo can rank. Keys are lower case.
 */
export const REGION_CITIES: Record<string, readonly string[]> = {
  'north america': ['Los Angeles', 'New York', 'Toronto'],
  us: ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  usa: ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  'united states': ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  america: ['Los Angeles', 'New York', 'Chicago', 'Atlanta'],
  canada: ['Toronto', 'Vancouver'],
  'latin america': ['São Paulo', 'Mexico City'],
  brazil: ['São Paulo'],
  europe: ['London', 'Berlin', 'Paris', 'Stockholm', 'Warsaw'],
  uk: ['London', 'Manchester'],
  'united kingdom': ['London', 'Manchester'],
  britain: ['London', 'Manchester'],
  germany: ['Berlin'],
  france: ['Paris'],
  spain: ['Madrid'],
  asia: ['Tokyo', 'Seoul', 'Singapore', 'Mumbai'],
  india: ['Mumbai', 'Delhi'],
  africa: ['Lagos', 'Johannesburg', 'Nairobi', 'Cairo'],
  'west africa': ['Lagos', 'Accra'],
  nigeria: ['Lagos', 'Abuja'],
  ghana: ['Accra'],
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
