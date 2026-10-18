import type { LaunchModuleKey, LaunchSectionKey } from '@oraqul/schema';

// The Film query catalog (spec §4.1). The model picks from these and fills in their context;
// code runs them, within the call budget, and turns each result into a finding. Every shaping
// parameter here is verified in qloo.md (2026-10-17, qloo:film-probes).

export const filmQueryKeys = [
  'audience',
  'markets',
  'themes',
  'shows',
  'cinemas',
  'music',
  'brands',
  'films',
  'podcasts',
  'community',
] as const;
export type FilmQueryKey = (typeof filmQueryKeys)[number];

export interface FilmQuerySpec {
  key: FilmQueryKey;
  /** `core` queries run for every plan; the others only when their module is in it. */
  for: 'core' | LaunchModuleKey;
  /** Sections whose lines usually cite it. Any line may cite any finding. */
  feeds: LaunchSectionKey[];
  /** For the chat trace, as "Asking Qloo about …". */
  label: string;
}

export const FILM_QUERIES: Record<FilmQueryKey, FilmQuerySpec> = {
  audience: {
    key: 'audience',
    for: 'core',
    feeds: ['audience', 'bottom-line'],
    label: "the comps' audience by age and gender",
  },
  markets: {
    key: 'markets',
    for: 'core',
    feeds: ['markets', 'bottom-line'],
    label: 'where in your cities that audience is strongest',
  },
  themes: {
    key: 'themes',
    for: 'core',
    feeds: ['positioning'],
    label: 'the themes and archetypes your comps share',
  },
  shows: {
    key: 'shows',
    for: 'core',
    feeds: ['audience', 'placement', 'publicity'],
    label: 'the series that audience watches in each city',
  },
  cinemas: {
    key: 'cinemas',
    for: 'core',
    feeds: ['markets'],
    label: 'the cinemas that audience goes to',
  },
  music: {
    key: 'music',
    for: 'partnerships',
    feeds: ['partnerships', 'audience'],
    label: 'the artists that audience plays',
  },
  brands: {
    key: 'brands',
    for: 'partnerships',
    feeds: ['partnerships'],
    label: 'the brands that audience uses',
  },
  films: {
    key: 'films',
    for: 'placement',
    feeds: ['placement', 'positioning'],
    label: 'the recent films that audience watched',
  },
  podcasts: {
    key: 'podcasts',
    for: 'publicity',
    feeds: ['publicity'],
    label: 'the podcasts that audience hears',
  },
  community: {
    key: 'community',
    for: 'community',
    feeds: ['community'],
    label: 'the churches, campuses and venues where that audience gathers',
  },
};

/** Tag namespaces each query's phrases must resolve into, and the parent type for brands. */
export const TAG_SPACES = {
  music: { prefix: 'urn:tag:genre:music', parent: null },
  podcasts: { prefix: 'urn:tag:genre:media', parent: null },
  films: { prefix: 'urn:tag:genre:media', parent: null },
  brands: { prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
  community: { prefix: 'urn:tag:category:place', parent: null },
  cinemas: { prefix: 'urn:tag:category:place', parent: null },
} as const;

/** Most calls one query may make, so one module cannot spend the run's budget. */
export const MAX_CITIES_PER_QUERY = 5;

// Defaults the scripted planner uses with no model, and the model's starting point. Phrases are
// resolved to tags in Qloo, never sent as they are.

/** A music scene by the launch's country of origin. No scene means the artist query is skipped. */
export const MUSIC_SCENES: Record<string, string> = {
  nigeria: 'afrobeats',
  ghana: 'afrobeats',
  'south africa': 'amapiano',
  jamaica: 'dancehall',
  'south korea': 'k-pop',
  korea: 'k-pop',
  'puerto rico': 'reggaeton',
  colombia: 'reggaeton',
};

/** A podcast genre by the launch's genre words. No match means the podcast query uses none. */
export const PODCAST_GENRES: { match: RegExp; phrase: string }[] = [
  { match: /crime|thriller|gangster|heist|detective|mystery/i, phrase: 'true crime' },
  { match: /comedy|comic/i, phrase: 'comedy' },
  { match: /horror/i, phrase: 'horror' },
  { match: /documentar/i, phrase: 'documentary' },
];

/** Brand categories verified to give brands that operate in a city. Fashion gave luxury names. */
export const BRAND_CATEGORIES = ['telecom', 'beverage'];

export const COMMUNITY_PLACES = ['church', 'university'];

export const CINEMA_TAG = 'movie theater';

/** How far back "recent" reaches for films and series, in years before the current one. */
export const RECENT_FILMS = 3;
export const RECENT_SHOWS = 6;
