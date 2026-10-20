import type { LaunchModuleKey } from '@oraqul/schema';
import { SECTION_TITLES as SHARED_TITLES, type Beat as SharedBeat } from '../launch';

export { type DatedBeat, datedBeats, TASTE_CLAIM } from '../launch';

/** Section titles for a Podcasts plan: the shared ones, reworded where podcasts say it differently. */
export const SECTION_TITLES = {
  ...SHARED_TITLES,
  markets: 'Markets',
  publicity: 'Press and newsletters',
  cadence: 'Episode cadence',
  partnerships: 'Sponsors',
  community: 'Community',
  timeline: 'Launch beats',
} as const;

// A launch is planned for one kind. The model reads it from the brief; when the brief does not
// say, code assumes a debut and the plan says what it assumed.
export const launchKinds = ['debut', 'season'] as const;
export type LaunchKind = (typeof launchKinds)[number];

export const formats = ['audio', 'video', 'both'] as const;
export type Format = (typeof formats)[number];

export const styles = ['interview', 'narrative', 'chat', 'news'] as const;
export type Style = (typeof styles)[number];

export const platforms = ['apple', 'spotify', 'youtube'] as const;
export type Platform = (typeof platforms)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  apple: 'Apple Podcasts',
  spotify: 'Spotify',
  youtube: 'YouTube',
};

/** The words in a brief that name each platform. */
const PLATFORM_WORDS: Record<Platform, RegExp> = {
  apple: /\b(apple podcasts?|itunes)\b/i,
  spotify: /\bspotify\b/i,
  youtube: /\b(youtube|yt)\b/i,
};

/** Platforms named in some words, in a fixed order. */
export function platformsFrom(text: string): Platform[] {
  return platforms.filter((p) => PLATFORM_WORDS[p].test(text));
}

const VIDEO = /\b(video|vodcast|filmed|on camera|youtube)\b/i;
const AUDIO_ONLY = /\baudio[- ]only\b/i;

/**
 * The format a brief describes, or null when it says nothing. A video show on YouTube is also an
 * audio feed, so a brief that names a video word and an audio platform is `both`.
 */
export function formatFrom(text: string, named: readonly Platform[]): Format | null {
  if (AUDIO_ONLY.test(text)) return 'audio';
  const video = VIDEO.test(text) || named.includes('youtube');
  const audio = /\baudio\b/i.test(text) || named.includes('apple') || named.includes('spotify');
  if (video && audio) return 'both';
  if (video) return 'video';
  return audio ? 'audio' : null;
}

/** The format a brief says nothing about: an audio feed, the common case. */
export const DEFAULT_FORMAT: Format = 'audio';

const NEW_SEASON =
  /\b(season\s*(?:\d+|two|three|four|five|2|3)|new season|next season|second season|returning)\b/i;
const DEBUT =
  /\b(debut|launch(?:ing)? (?:a|our|my) (?:new )?(?:podcast|show)|new (?:podcast|show)|brand new|first episode|pilot)\b/i;

/** The kind a brief describes, or null when it says nothing. A new show wins over a season word. */
export function kindFrom(text: string): LaunchKind | null {
  if (DEBUT.test(text)) return 'debut';
  if (NEW_SEASON.test(text)) return 'season';
  return null;
}

/** A launch kind with nothing said: a new show, the case that needs the most planning. */
export const DEFAULT_KIND: LaunchKind = 'debut';

const STYLE_WORDS: Record<Style, RegExp> = {
  interview: /\b(interview|conversation|guests?)\b/i,
  narrative:
    /\b(narrative|storytelling|documentary|investigat\w*|true[- ]crime|serialis?ed|scripted)\b/i,
  chat: /\b(chat|banter|comedy|co-?hosts?|round-?table)\b/i,
  news: /\b(news|daily briefing|current affairs|politics|explainer)\b/i,
};

/** The style a brief describes, in a fixed order, or null when it says nothing. */
export function styleFrom(text: string): Style | null {
  return styles.find((s) => STYLE_WORDS[s].test(text)) ?? null;
}

/** The modules a Podcasts plan can carry. Which it gets depends on the kind and the format. */
export const PODCASTS_MODULES = [
  'crosspromo',
  'guests',
  'partnerships',
  'publicity',
  'video',
  'live',
  'community',
  'cadence',
  'timeline',
  'budget',
  'measure',
  'risks',
] as const satisfies readonly LaunchModuleKey[];

export interface ModuleInput {
  scope: 'full' | 'narrow';
  /** The module a narrow ask names. Null when it names only core sections, such as markets. */
  ask: LaunchModuleKey | null;
  kind: LaunchKind;
  format: Format;
  style: Style | null;
  /** Whether the team named a guest, so a narrative show can still plan for guests. */
  hasGuests: boolean;
  hasBudget: boolean;
}

export interface ModulePick {
  modules: LaunchModuleKey[];
  /** Modules the brief rules out, and why, for the Gaps section. */
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules a plan carries on top of the core (spec §6.1). A kind has its own order: a new season
 * has no editorial pitch for a show nobody has heard, and an audio only show has no video
 * section. Budget split is always offered: shares with no budget, amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  const ruledOut: ModulePick['ruledOut'] = [];
  const offered = KIND_PROFILES[input.kind].modules;
  const allowed: LaunchModuleKey[] = PODCASTS_MODULES.filter((key) => {
    if (!offered.includes(key)) return false;
    const why = ruleOut(key, input);
    if (why) ruledOut.push({ key, why });
    return why === null;
  });
  // A plan lists its modules in the kind's order, not the catalogue's.
  allowed.sort((a, b) => offered.indexOf(a) - offered.indexOf(b));
  if (input.scope === 'full') return { modules: allowed, ruledOut };
  const asked = input.ask;
  const askedOut =
    asked && !offered.includes(asked)
      ? [{ key: asked, why: 'This launch kind does not carry that section.' }]
      : [];
  return {
    modules: asked && allowed.includes(asked) ? [asked] : [],
    ruledOut: [...ruledOut.filter((r) => r.key === asked), ...askedOut],
  };
}

function ruleOut(key: LaunchModuleKey, input: ModuleInput): string | null {
  switch (key) {
    case 'video':
      return input.format === 'audio'
        ? 'A video section is for a show that is filmed. Say if it is on YouTube.'
        : null;
    case 'guests':
      return input.style === 'narrative' && !input.hasGuests
        ? 'A narrative show has no guest slot unless you name guests.'
        : null;
    default:
      return null;
  }
}

/** One step of a launch calendar, for a show on these platforms. */
export type Beat = SharedBeat<Platform>;

export interface KindProfile {
  label: string;
  /** For a sentence: "Planned as a ___ launch". */
  short: string;
  /** In plan order. */
  modules: readonly LaunchModuleKey[];
  beats: readonly Beat[];
  /** Named, never given a target: the plan does not forecast. */
  measures: readonly string[];
  /**
   * Shares for a Budget split, labelled a starting split in the plan. Amounts are computed by
   * code. TODO(verify): with a network.
   */
  budget: readonly { line: string; share: number }[];
  /** Table cities that stand in for markets when the brief names none. Shown as Worth a look. */
  defaultCities: readonly string[];
}

const debutBeats: readonly Beat[] = [
  {
    at: -8,
    until: -6,
    key: 'artwork-feed',
    text: 'Lock the cover art, the show description and the feed. Test it in Apple Podcasts and Spotify before anything is announced.',
  },
  {
    at: -6,
    key: 'editorial',
    text: 'Send the platforms your pitch for editorial placement: a short note on the show, the host and why it is new. Apple and Spotify both take pitches from the show dashboard.',
    platforms: ['apple', 'spotify'],
  },
  {
    at: -4,
    key: 'trailer',
    text: 'Publish the trailer to the feed so people can follow before episode one. Cut a short clip of it for social.',
  },
  {
    at: -3,
    until: -1,
    key: 'swaps',
    text: 'Book the cross promotion: a guest slot or a trailer swap on each show you want to reach, recorded before launch.',
  },
  {
    at: 0,
    key: 'launch',
    text: 'Release the first three episodes at once, so a new listener can stay. Send the trailer swap and the press note the same day.',
  },
  {
    at: 1,
    until: 4,
    key: 'chart-window',
    text: 'Ask every listener you can reach to follow, rate and review in the first week: early follows and ratings decide how the show is placed. Keep episodes weekly.',
  },
  {
    at: 4,
    until: 8,
    key: 'first-read',
    text: 'Read the first month: which episodes held listeners, which markets and ages came. Move the next swaps and ads to what worked.',
  },
  {
    at: 0,
    until: 8,
    key: 'clips',
    text: 'Publish a clip of every episode with captions, and a full episode on YouTube.',
    platforms: ['youtube'],
  },
];

const seasonBeats: readonly Beat[] = [
  {
    at: -6,
    key: 'announce',
    text: 'Tell the current feed that a new season is coming, and the date. The people already following are the cheapest launch audience.',
  },
  {
    at: -4,
    key: 'trailer',
    text: 'Publish the season trailer to the feed and cut a clip for social.',
  },
  {
    at: -3,
    until: -1,
    key: 'swaps',
    text: 'Book the cross promotion: a guest slot or a trailer swap on each show you want to reach, recorded before the premiere.',
  },
  {
    at: -2,
    key: 'back-catalogue',
    text: 'Pick the best three episodes of earlier seasons and pin them as the entry point for a new listener.',
  },
  {
    at: 0,
    key: 'premiere',
    text: 'Release the premiere and the next episode together. Send the press note and the swaps the same day.',
  },
  {
    at: 1,
    until: 4,
    key: 'chart-window',
    text: 'Keep the weekly release and ask followers for ratings and reviews of the new season.',
  },
  {
    at: 4,
    until: 8,
    key: 'first-read',
    text: 'Read the first month against the last season: what held listeners and where new ones came from. Plan the next swaps from it.',
  },
  {
    at: 0,
    until: 8,
    key: 'clips',
    text: 'Publish a clip of every episode with captions, and a full episode on YouTube.',
    platforms: ['youtube'],
  },
];

export const KIND_PROFILES: Record<LaunchKind, KindProfile> = {
  debut: {
    label: 'New show',
    short: 'new show',
    modules: [
      'crosspromo',
      'guests',
      'partnerships',
      'publicity',
      'video',
      'live',
      'community',
      'cadence',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: debutBeats,
    measures: [
      'Followers by market and age band in the first month',
      'Downloads of each episode at 7 and 30 days',
      'Share of listeners who finish an episode',
      'Where new listeners came from, by show or channel',
    ],
    budget: [
      { line: 'Cross promotion and paid listener growth', share: 0.35 },
      { line: 'Production and editing', share: 0.25 },
      { line: 'Publicity, press and newsletters', share: 0.15 },
      { line: 'Video and clips', share: 0.1 },
      { line: 'Live and community', share: 0.05 },
      { line: 'Contingency', share: 0.1 },
    ],
    defaultCities: ['Lagos', 'London', 'New York', 'Johannesburg', 'Toronto'],
  },
  season: {
    label: 'New season',
    short: 'new season',
    modules: [
      'crosspromo',
      'partnerships',
      'guests',
      'video',
      'publicity',
      'live',
      'community',
      'cadence',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: seasonBeats,
    measures: [
      'Followers added against the last season, by market and age band',
      'Downloads of the premiere and each episode at 7 and 30 days',
      'Share of the last season’s listeners who return',
      'Where new listeners came from, by show or channel',
    ],
    budget: [
      { line: 'Cross promotion and paid listener growth', share: 0.3 },
      { line: 'Production and editing', share: 0.25 },
      { line: 'Sponsor and partner support', share: 0.1 },
      { line: 'Publicity, press and newsletters', share: 0.1 },
      { line: 'Video and clips', share: 0.1 },
      { line: 'Live and community', share: 0.05 },
      { line: 'Contingency', share: 0.1 },
    ],
    defaultCities: ['Lagos', 'London', 'New York', 'Johannesburg', 'Toronto'],
  },
};

/** The beats for a show on these platforms, in calendar order. */
export function beatsFor(kind: LaunchKind, named: readonly Platform[]): Beat[] {
  return KIND_PROFILES[kind].beats
    .filter((b) => !b.platforms || b.platforms.some((p) => named.includes(p)))
    .sort((a, b) => a.at - b.at);
}

/** The platforms a show is on: the ones named, or the usual ones for its format. */
export function platformsFor(named: readonly Platform[], format: Format): Platform[] {
  if (named.length) return [...named];
  return format === 'audio' ? ['apple', 'spotify'] : ['apple', 'spotify', 'youtube'];
}
