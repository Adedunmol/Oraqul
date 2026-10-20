import type { LaunchModuleKey } from '@oraqul/schema';
import { SECTION_TITLES as SHARED_TITLES } from '../launch';

export { TASTE_CLAIM } from '../launch';

/** Section titles for a Games plan: the shared ones, reworded where games say it differently. */
export const SECTION_TITLES = {
  ...SHARED_TITLES,
  markets: 'Regions',
  publicity: 'Press and podcasts',
  partnerships: 'Brand partners',
  community: 'Community',
  timeline: 'Launch beats',
} as const;

// A launch is planned for one kind. The model reads it from the brief; when the brief does not
// say, code assumes the first match below and the plan says what it assumed.
export const launchKinds = ['premium', 'early_access', 'free_to_play', 'mobile'] as const;
export type LaunchKind = (typeof launchKinds)[number];

export const platforms = ['pc', 'playstation', 'xbox', 'switch', 'ios', 'android', 'vr'] as const;
export type Platform = (typeof platforms)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  pc: 'PC',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  switch: 'Switch',
  ios: 'iOS',
  android: 'Android',
  vr: 'VR',
};

/** The words in a brief that name each platform. */
const PLATFORM_WORDS: Record<Platform, RegExp> = {
  pc: /\b(pc|steam|windows|epic games|gog)\b/i,
  playstation: /\b(playstation|ps4|ps5|psn)\b/i,
  xbox: /\bxbox\b/i,
  switch: /\b(switch|nintendo)\b/i,
  ios: /\b(ios|iphone|ipad|app store)\b/i,
  android: /\b(android|google play)\b/i,
  vr: /\b(vr|quest|psvr)\b/i,
};

/** Platforms named in some words, in a fixed order. */
export function platformsFrom(text: string): Platform[] {
  return platforms.filter((p) => PLATFORM_WORDS[p].test(text));
}

const EARLY_ACCESS = /\bearly[- ]access\b/i;
const FREE_TO_PLAY = /\b(free[- ]to[- ]play|f2p|live[- ]service|battle pass|season pass|gacha)\b/i;
const MOBILE = /\bmobile\b/i;

/**
 * The kind a brief describes, or null when it says nothing. Early access first, since an early
 * access title is also a PC release. Mobile before free to play, since most mobile games are.
 */
export function kindFrom(text: string, named: readonly Platform[]): LaunchKind | null {
  if (EARLY_ACCESS.test(text)) return 'early_access';
  const mobileOnly = named.length > 0 && named.every((p) => p === 'ios' || p === 'android');
  if (mobileOnly || MOBILE.test(text)) return 'mobile';
  if (FREE_TO_PLAY.test(text)) return 'free_to_play';
  return null;
}

/** A launch kind with nothing said: a paid PC release, the most common case. */
export const DEFAULT_KIND: LaunchKind = 'premium';

/** The modules a Games plan can carry. Which it gets depends on the launch kind. */
export const GAMES_MODULES = [
  'store',
  'earlyaccess',
  'softlaunch',
  'events',
  'collabs',
  'creators',
  'liveops',
  'publicity',
  'partnerships',
  'community',
  'timeline',
  'budget',
  'measure',
  'risks',
] as const satisfies readonly LaunchModuleKey[];

export interface ModuleInput {
  scope: 'full' | 'narrow';
  /** The module a narrow ask names. Null when it names only core sections, such as regions. */
  ask: LaunchModuleKey | null;
  kind: LaunchKind;
  platforms: readonly Platform[];
  hasBudget: boolean;
}

export interface ModulePick {
  modules: LaunchModuleKey[];
  /** Modules the brief rules out, and why, for the Gaps section. */
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules a plan carries on top of the core (spec §6.1). A kind has its own order and its own
 * modules: a premium game has no seasons, a mobile game has no festival, a console-only game
 * has no soft launch. Budget split is always offered: shares with no budget, amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  const ruledOut: ModulePick['ruledOut'] = [];
  const offered = KIND_PROFILES[input.kind].modules;
  const allowed: LaunchModuleKey[] = GAMES_MODULES.filter((key) => {
    if (!offered.includes(key)) return false;
    const why = ruleOut(key, input);
    if (why) ruledOut.push({ key, why });
    return why === null;
  });
  // A plan lists its modules in the kind's order, not the catalogue's.
  allowed.sort((a, b) => offered.indexOf(a) - offered.indexOf(b));
  if (input.scope === 'full') return { modules: allowed, ruledOut };
  // A narrow ask for a module this kind does not carry is answered with why, not with silence.
  const asked = input.ask;
  const askedOut =
    asked && !offered.includes(asked) ? [{ key: asked, why: notForKind(asked) }] : [];
  return {
    modules: asked && allowed.includes(asked) ? [asked] : [],
    ruledOut: [...ruledOut.filter((r) => r.key === asked), ...askedOut],
  };
}

function notForKind(key: LaunchModuleKey): string {
  switch (key) {
    case 'liveops':
      return 'A premium launch has no season cadence. Patches sit in Launch beats.';
    case 'earlyaccess':
      return 'An early access roadmap is only for an early access launch.';
    case 'softlaunch':
      return 'A soft launch is for mobile releases.';
    default:
      return 'This launch kind does not carry that section.';
  }
}

function ruleOut(key: LaunchModuleKey, input: ModuleInput): string | null {
  const named = input.platforms;
  switch (key) {
    case 'events':
      return named.some((p) => p === 'pc' || p === 'playstation' || p === 'xbox' || p === 'switch')
        ? null
        : 'Steam festivals and console showcases need a PC or console release.';
    case 'softlaunch':
      return named.some((p) => p === 'ios' || p === 'android')
        ? null
        : 'A soft launch is for iOS and Android releases.';
    default:
      return null;
  }
}

/** One step of a launch calendar, in weeks from the release. Negative is before it. */
export interface Beat {
  /** First week of the beat. */
  at: number;
  /** Last week, when the beat spans weeks. */
  until?: number;
  key: string;
  /** Playbook wording: it says what to do, never what an audience likes. */
  text: string;
  /** Only for a launch on one of these platforms. */
  platforms?: readonly Platform[];
}

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
   * code. TODO(verify): with a publisher.
   */
  budget: readonly { line: string; share: number }[];
  /** Used when the brief names none. */
  defaultPlatforms: readonly Platform[];
  /** Table cities that stand in for regions when the brief names none. Shown as Worth a look. */
  defaultCities: readonly string[];
}

const CONSOLES: readonly Platform[] = ['playstation', 'xbox', 'switch'];
const MOBILE_STORES: readonly Platform[] = ['ios', 'android'];

const premiumBeats: readonly Beat[] = [
  {
    at: -52,
    until: -26,
    key: 'store-page',
    text: 'Publish the store page and start the wishlist drive: capsule art, trailer, tags and a first line that names the genre.',
  },
  {
    at: -26,
    until: -12,
    key: 'demo',
    text: 'Release a demo months ahead and build a creator and community beat around it. Enter a festival with a polished demo update, never as the first beat.',
    platforms: ['pc'],
  },
  {
    at: -10,
    key: 'console-cert',
    text: 'Submit for console certification and age ratings. Allow weeks for ratings and for a failed check.',
    platforms: CONSOLES,
  },
  {
    at: -6,
    until: -4,
    key: 'preview-keys',
    text: 'Send preview keys and the press kit to the first wave of creators and press.',
  },
  {
    at: -4,
    key: 'freeze',
    text: 'Freeze the store page and check wishlists against the target. Decide whether to delay or ship.',
    platforms: ['pc'],
  },
  {
    at: -2,
    key: 'date-lock',
    text: 'Lock the release date and send launch keys to the second wave of creators. Steam locks the date 14 days out.',
  },
  {
    at: -1,
    key: 'launch-trailer',
    text: 'Release the launch trailer, start the countdown and email the wishlist.',
  },
  {
    at: 0,
    key: 'launch',
    text: 'Lift the embargo, run the launch discount and watch reviews closely for the first 72 hours.',
  },
  {
    at: 1,
    until: 4,
    key: 'patch',
    text: 'Ship the first patch from launch feedback and answer the top complaints in public.',
  },
  {
    at: 4,
    until: 8,
    key: 'first-discount',
    text: 'Plan the first discount after the 30-day cooldown that follows a launch discount on Steam.',
    platforms: ['pc'],
  },
];

const earlyAccessBeats: readonly Beat[] = [
  ...premiumBeats.filter((b) => b.key !== 'demo' && !b.key.startsWith('patch')),
  {
    at: -2,
    key: 'roadmap',
    text: 'Publish the roadmap with the planned 1.0 date. Promise only what the team can ship.',
  },
  {
    at: 1,
    until: 78,
    key: 'updates',
    text: 'Ship an update every four to six weeks and post the roadmap progress with each one.',
  },
  {
    at: 60,
    until: 78,
    key: 'one-point-oh',
    text: 'Plan 1.0 as a second launch: trailer, date, press keys two weeks out, and a content drop that headlines the announcement.',
  },
];

const freeToPlayBeats: readonly Beat[] = [
  {
    at: -16,
    key: 'closed-beta',
    text: 'Run a closed beta for feedback and retention data. Gate it with sign-ups or a founder pack and write the exit criteria down.',
  },
  {
    at: -8,
    key: 'pre-registration',
    text: 'Open pre-registration or wishlists and start the creator and community beats.',
  },
  {
    at: -6,
    key: 'open-beta',
    text: 'Open the beta to everyone, carry progress over to launch and test the servers under load.',
  },
  {
    at: -2,
    key: 'creator-wave',
    text: 'Send launch access to creators so coverage lands in the launch window.',
  },
  {
    at: 0,
    key: 'season-1',
    text: 'Launch with season 1 and a first limited-time event.',
  },
  {
    at: 8,
    until: 12,
    key: 'season-2',
    text: 'Plan each season on an eight to twelve week cadence, with a collab or event beat in every one.',
  },
];

const mobileBeats: readonly Beat[] = [
  {
    at: -26,
    until: -12,
    key: 'soft-launch',
    text: 'Soft launch in two or three test markets (commonly Canada, Australia, the Nordics or the Philippines) to measure retention before a global push.',
  },
  {
    at: -12,
    key: 'soft-launch-gate',
    text: 'Check the soft launch against your own gates: day 1, 7 and 30 retention and cost per install. Fix the first session before scaling.',
  },
  {
    at: -8,
    key: 'pre-registration',
    text: 'Open pre-registration on the stores.',
    platforms: MOBILE_STORES,
  },
  {
    at: -8,
    until: -6,
    key: 'featuring',
    text: 'Submit the store featuring nomination while the team has weeks, not days.',
    platforms: MOBILE_STORES,
  },
  {
    at: -2,
    key: 'creator-wave',
    text: 'Send launch access to creators so coverage lands in the launch window.',
  },
  {
    at: 0,
    key: 'global-launch',
    text: 'Global launch. Start paid acquisition only in the markets whose soft-launch retention held.',
  },
  {
    at: 2,
    until: 12,
    key: 'live-events',
    text: 'Run the first live event and the first update on a fixed schedule, and put spend into the markets that hold retention.',
  },
];

export const KIND_PROFILES: Record<LaunchKind, KindProfile> = {
  premium: {
    label: 'Premium (PC and console)',
    short: 'premium',
    modules: [
      'store',
      'events',
      'collabs',
      'creators',
      'publicity',
      'partnerships',
      'community',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: premiumBeats,
    measures: [
      'Wishlists by region',
      'Wishlist to purchase in launch week',
      'Review score in the first 72 hours',
      'Day 7 retention',
      'Median playtime',
      'Refund rate',
    ],
    budget: [
      { line: 'Trailers and store assets', share: 0.2 },
      { line: 'Creators and keys', share: 0.2 },
      { line: 'Paid media', share: 0.25 },
      { line: 'Festivals and showcases', share: 0.15 },
      { line: 'PR and press', share: 0.1 },
      { line: 'Contingency', share: 0.1 },
    ],
    defaultPlatforms: ['pc'],
    defaultCities: ['Los Angeles', 'London', 'Berlin', 'Seoul', 'São Paulo'],
  },
  early_access: {
    label: 'Early access',
    short: 'early access',
    modules: [
      'store',
      'earlyaccess',
      'events',
      'community',
      'creators',
      'collabs',
      'publicity',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: earlyAccessBeats,
    measures: [
      'Wishlists by region',
      'Review score and its trend after each update',
      'Day 7 retention',
      'Median playtime',
      'Feedback volume and what players ask for most',
      'Refund rate',
    ],
    budget: [
      { line: 'Community and developer updates', share: 0.2 },
      { line: 'Creators and keys', share: 0.2 },
      { line: 'Trailers and store assets', share: 0.2 },
      { line: 'Paid media', share: 0.15 },
      { line: 'Festivals and showcases', share: 0.1 },
      { line: 'PR and press', share: 0.05 },
      { line: 'Contingency', share: 0.1 },
    ],
    defaultPlatforms: ['pc'],
    defaultCities: ['Los Angeles', 'London', 'Berlin', 'Seoul', 'São Paulo'],
  },
  free_to_play: {
    label: 'Free to play and live service',
    short: 'free-to-play',
    modules: [
      'collabs',
      'creators',
      'liveops',
      'community',
      'events',
      'store',
      'partnerships',
      'publicity',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: freeToPlayBeats,
    measures: [
      'Beta sign-ups by region',
      'Day 1, 7 and 30 retention',
      'Payer conversion',
      'Season engagement',
      'Cost per install by region',
    ],
    budget: [
      { line: 'Paid user acquisition', share: 0.35 },
      { line: 'Creators', share: 0.2 },
      { line: 'Collabs and live events', share: 0.15 },
      { line: 'Community', share: 0.1 },
      { line: 'Creative (trailers, key art)', share: 0.1 },
      { line: 'Contingency', share: 0.1 },
    ],
    defaultPlatforms: ['pc', 'playstation', 'xbox'],
    defaultCities: ['Los Angeles', 'London', 'Seoul', 'Singapore', 'São Paulo'],
  },
  mobile: {
    label: 'Mobile',
    short: 'mobile',
    modules: [
      'softlaunch',
      'store',
      'collabs',
      'creators',
      'liveops',
      'community',
      'partnerships',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: mobileBeats,
    measures: [
      'Pre-registrations by country',
      'Day 1, 7 and 30 retention by soft-launch market',
      'Cost per install by market',
      'Store page conversion',
      'Store featuring',
    ],
    budget: [
      { line: 'Paid user acquisition', share: 0.45 },
      { line: 'Ad creative', share: 0.15 },
      { line: 'Soft-launch tests', share: 0.1 },
      { line: 'Store listing and ASO', share: 0.1 },
      { line: 'Creators', share: 0.1 },
      { line: 'Contingency', share: 0.1 },
    ],
    defaultPlatforms: ['ios', 'android'],
    defaultCities: ['Toronto', 'Sydney', 'Stockholm', 'Manila', 'Auckland'],
  },
};

/** The beats for a launch on these platforms, in calendar order. */
export function beatsFor(kind: LaunchKind, named: readonly Platform[]): Beat[] {
  return KIND_PROFILES[kind].beats
    .filter((b) => !b.platforms || b.platforms.some((p) => named.includes(p)))
    .sort((a, b) => a.at - b.at);
}

export interface DatedBeat extends Beat {
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
export function datedBeats(
  beats: readonly Beat[],
  release: string | null,
  today: string,
): DatedBeat[] {
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

/**
 * Rules of the stores and platforms that shape a calendar. Launch knowledge, never Qloo data, so a
 * line that states one is playbook. Dates of festivals, sales and showcases are not here: they
 * change every year and come from research.
 * TODO(verify): each rule against Steamworks and the platform portals before a plan leads with it.
 */
export const PLATFORM_RULES: {
  key: string;
  platforms: readonly Platform[];
  text: string;
  source: string;
}[] = [
  {
    key: 'steam-coming-soon',
    platforms: ['pc'],
    text: 'The Steam Coming Soon page must be live at least two weeks before release. Allow about four weeks in practice, since the page needs a review first.',
    source: 'https://www.steampageanalyzer.com/blog/steam-launch-strategy',
  },
  {
    key: 'steam-date-lock',
    platforms: ['pc'],
    text: 'Steam locks the release date 14 days out. A change inside that window means contacting Valve.',
    source: 'https://www.steampageanalyzer.com/blog/steam-launch-strategy',
  },
  {
    key: 'steam-festival',
    platforms: ['pc'],
    text: 'A title can join a Steam Next Fest once, and registration closes about seven weeks before the festival. Pre-festival wishlists decide how much it adds.',
    source: 'https://www.steampageanalyzer.com/blog/steam-launch-strategy',
  },
  {
    key: 'steam-sales',
    platforms: ['pc'],
    text: 'Avoid releasing at or just before a seasonal sale starts, and wait out the 30-day cooldown after a launch discount.',
    source: 'https://www.steampageanalyzer.com/blog/steam-launch-strategy',
  },
  {
    key: 'console-cert',
    platforms: CONSOLES,
    text: 'Console certification needs an age rating first, and a failed check can cost weeks. Start validating during alpha and send the build well before the date.',
    source:
      'https://www.mcvuk.com/business-news/publishing/six-tips-for-managing-multi-platform-game-releases/',
  },
  {
    key: 'mobile-soft-launch',
    platforms: MOBILE_STORES,
    text: 'A soft launch needs at least 30 days to read day 30 retention, and about 60 to read it across 30 cohorts.',
    source: 'https://a16z.com/mobile-game-soft-launch/',
  },
];

/** The platform rules for a launch on these platforms. */
export function rulesFor(named: readonly Platform[]) {
  return PLATFORM_RULES.filter((r) => r.platforms.some((p) => named.includes(p)));
}
