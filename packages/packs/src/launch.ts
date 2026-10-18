import type { LaunchSectionKey } from '@oraqul/schema';

// What every category's launch plan shares (spec §6.1, §6.2). A category's own pack adds its
// modules, its query catalog and its budget convention.

/** Section titles, as the Plan tab and the exports show them. A pack may reword some. */
export const SECTION_TITLES = {
  'bottom-line': 'Bottom line',
  positioning: 'Positioning',
  audience: 'Audience',
  markets: 'Markets',
  gaps: 'To sharpen this plan',
  partnerships: 'Partnerships',
  placement: 'Creative placement',
  publicity: 'Publicity and media',
  community: 'Community and grassroots',
  route: 'Release route and window',
  timeline: 'Timeline',
  cadence: 'Release cadence',
  budget: 'Budget split',
  measure: 'What to measure',
  risks: 'Risks',
  tour: 'Tour route',
  support: 'Support acts',
  sync: 'Sync and placement',
} as const satisfies Record<LaunchSectionKey, string>;

/**
 * Words that claim what an audience likes. A playbook line may not use them: taste claims must
 * cite a finding (spec §6.2).
 */
export const TASTE_CLAIM =
  /\b(fans?|fandoms?|loves?|loved|likes?|liked|prefers?|preferred|resonat\w*|affinit\w*|skews?|skewed|over-?index\w*|popular (?:with|among)|tastes?|enjoys?|enjoyed|devoted)\b/i;

/** A music scene by a country of origin. No scene means the artist query is skipped. */
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

/** A podcast genre by a launch's genre words. No match means the podcast query uses none. */
export const PODCAST_GENRES: { match: RegExp; phrase: string }[] = [
  { match: /crime|thriller|gangster|heist|detective|mystery/i, phrase: 'true crime' },
  { match: /comedy|comic/i, phrase: 'comedy' },
  { match: /horror/i, phrase: 'horror' },
  { match: /documentar/i, phrase: 'documentary' },
];

/** Brand categories verified to give brands that operate in a city. Fashion gave luxury names. */
export const BRAND_CATEGORIES = ['telecom', 'beverage'];

/**
 * Mass-market names a named partner is scored against, as a confidence aid.
 * TODO(verify): that each name resolves to one exact match on the live host. One that does not
 * is left out of the baseline for that run.
 */
export const BASELINE_BRANDS = ['Coca-Cola', 'Nike', "McDonald's"];
export const BASELINE_PODCASTS = ['The Joe Rogan Experience', 'Crime Junkie', 'Serial'];

/** Most calls one query may make, so one module cannot spend the run's budget. */
export const MAX_CITIES_PER_QUERY = 5;
