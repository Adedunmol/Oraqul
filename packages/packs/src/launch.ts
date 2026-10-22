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
  collabs: 'Fan base collabs',
  creators: 'Creators and streamers',
  store: 'Store page and tags',
  events: 'Festivals and showcases',
  softlaunch: 'Soft launch',
  liveops: 'Seasons and retention',
  earlyaccess: 'Early access roadmap',
  crosspromo: 'Cross promotion shows',
  guests: 'Guests',
  live: 'Live shows',
  video: 'Video and clips',
  comps: 'Comp titles',
  adaptation: 'Screen and audio angles',
  retail: 'Retail and pre-orders',
  audio: 'Audiobook',
  schools: 'Schools and libraries',
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
 * Mass-market names a named partner is scored against, as a confidence aid. Each name resolves to
 * one exact match on the live host (checked); one that stops doing so is left out of the baseline
 * for that run.
 */
export const BASELINE_BRANDS = ['Coca-Cola', 'Nike', "McDonald's"];
export const BASELINE_PODCASTS = ['The Joe Rogan Experience', 'Crime Junkie', 'Serial'];
export const BASELINE_BOOKS = ['Where the Crawdads Sing', 'Atomic Habits', 'Gone Girl'];

/** Most calls one query may make, so one module cannot spend the run's budget. */
export const MAX_CITIES_PER_QUERY = 5;

/** One step of a launch calendar, in weeks from the release. Negative is before it. */
export interface Beat<P extends string = string> {
  /** First week of the beat. */
  at: number;
  /** Last week, when the beat spans weeks. */
  until?: number;
  key: string;
  /** Playbook wording: it says what to do, never what an audience likes. */
  text: string;
  /** Only for a launch on one of these platforms. */
  platforms?: readonly P[];
}

export interface DatedBeat<P extends string = string> extends Beat<P> {
  /** `YYYY-MM-DD`, or null when the release date is not known. */
  from: string | null;
  to: string | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Puts dates on the beats from a release date, and drops any beat that is already over on
 * `today`: a plan never advises around a date that has passed. With no release date the beats
 * keep their weeks and have no dates.
 */
export function datedBeats<P extends string>(
  beats: readonly Beat<P>[],
  release: string | null,
  today: string,
): DatedBeat<P>[] {
  const releaseMs = release ? Date.parse(`${release}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(releaseMs)) return beats.map((b) => ({ ...b, from: null, to: null }));
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  return beats.flatMap((b) => {
    const fromMs = releaseMs + b.at * WEEK_MS;
    const toMs =
      releaseMs +
      (b.until ?? b.at) * WEEK_MS +
      (b.until === undefined ? 0 : 6 * 24 * 60 * 60 * 1000);
    if (toMs < todayMs) return [];
    return [{ ...b, from: day(fromMs), to: day(toMs) }];
  });
}
