import type { LaunchModuleKey } from '@oraqul/schema';
import { SECTION_TITLES as SHARED_TITLES, type Beat as SharedBeat } from '../launch';

export { type DatedBeat, datedBeats, TASTE_CLAIM } from '../launch';

/** Section titles for a Books plan: the shared ones, reworded where publishing says it differently. */
export const SECTION_TITLES = {
  ...SHARED_TITLES,
  markets: 'Markets',
  partnerships: 'Brand partners',
  publicity: 'Press and reviews',
  events: 'Events and festivals',
  creators: 'BookTok and creators',
  community: 'Book clubs and community',
  cadence: 'Series and backlist',
  timeline: 'Launch beats',
} as const;

// A launch is planned for one kind. The model reads it from the brief; when the brief does not
// say, code assumes a debut and the plan says what it assumed.
export const launchKinds = ['debut', 'frontlist', 'series', 'backlist'] as const;
export type LaunchKind = (typeof launchKinds)[number];

/** How the book reaches shops: through a publisher's sales team, or on the author's own. */
export const routes = ['traditional', 'indie'] as const;
export type Route = (typeof routes)[number];

export const readerships = ['adult', 'ya', 'children'] as const;
export type Readership = (typeof readerships)[number];

export const formats = ['print', 'ebook', 'audio'] as const;
export type Format = (typeof formats)[number];

const FORMAT_WORDS: Record<Format, RegExp> = {
  print: /\b(hardcover|hardback|paperback|print|physical)\b/i,
  ebook: /\b(e-?books?|kindle|kobo|digital)\b/i,
  audio: /\b(audio ?books?|audible|narrat\w+|audio)\b/i,
};

/** The formats a brief names, in a fixed order. */
export function formatsFrom(text: string): Format[] {
  return formats.filter((f) => FORMAT_WORDS[f].test(text));
}

const INDIE =
  /\b(self[- ]?publish\w*|indie (?:author|publish\w*)|independent(?:ly)? (?:author|publish\w*)|kdp|kindle direct|hybrid author)\b/i;
const TRADITIONAL =
  /\b(publisher|published by|imprint|(?:independent|small|university|major|big five) press|publishing house|penguin|harpercollins|hachette|macmillan|simon (?:&|and) schuster|my agent|literary agent|trade publish\w*|traditional\w*)\b/i;

/** The route a brief describes, or null when it says nothing. Self-publishing wins over a publisher word. */
export function routeFrom(text: string): Route | null {
  if (INDIE.test(text)) return 'indie';
  return TRADITIONAL.test(text) ? 'traditional' : null;
}

/** A route with nothing said: a publisher's sales team, the case with the most retail work. */
export const DEFAULT_ROUTE: Route = 'traditional';

const CHILDREN = /\b(children'?s?|picture books?|middle[- ]grade|early readers?|kids?)\b/i;
const YOUNG_ADULT = /\b(ya|young adult|teen\w*)\b/i;

/** The readership a brief describes, or null when it says nothing. */
export function readershipFrom(text: string): Readership | null {
  if (CHILDREN.test(text)) return 'children';
  return YOUNG_ADULT.test(text) ? 'ya' : null;
}

/** A readership with nothing said: adults. */
export const DEFAULT_READERSHIP: Readership = 'adult';

const BACKLIST =
  /\b(reissue\w*|re-?releas\w*|backlist|anniversary|new edition|paperback (?:edition|release|launch)|film tie-?in|tie-?in edition|relaunch\w*|re-?packag\w*|new cover)\b/i;
const SERIES =
  /\b(book (?:two|three|four|five|2|3|4|5|ii|iii|iv)|sequel|next (?:book )?in the series|series finale|final book|trilogy|duology|new book in)\b/i;
const DEBUT = /\b(debut|first novel|first book|first-time author|first time author)\b/i;
const FRONTLIST =
  /\b(?:(?:second|third|fourth|latest|upcoming|forthcoming)\s+(?:novel|book|memoir|collection)|author of)\b/i;

/** The kind a brief describes, or null when it says nothing. A debut wins over a series word. */
export function kindFrom(text: string): LaunchKind | null {
  if (DEBUT.test(text)) return 'debut';
  if (BACKLIST.test(text)) return 'backlist';
  if (SERIES.test(text)) return 'series';
  return FRONTLIST.test(text) ? 'frontlist' : null;
}

/** A launch kind with nothing said: a debut, the case that needs the most planning. */
export const DEFAULT_KIND: LaunchKind = 'debut';

/** The modules a Books plan can carry. Which it gets depends on the kind, route, readership and format. */
export const BOOKS_MODULES = [
  'comps',
  'adaptation',
  'retail',
  'publicity',
  'events',
  'creators',
  'partnerships',
  'community',
  'audio',
  'schools',
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
  route: Route;
  readership: Readership;
  /** Whether an audiobook is part of the launch. */
  audio: boolean;
  hasBudget: boolean;
}

export interface ModulePick {
  modules: LaunchModuleKey[];
  /** Modules the brief rules out, and why, for the Gaps section. */
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules a plan carries on top of the core (spec §6.1). A kind has its own order: a new book in a
 * series leads with the readers of the earlier ones, a reissue with the new cover and the screen
 * tie-in. Budget split is always offered: shares with no budget, amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  const ruledOut: ModulePick['ruledOut'] = [];
  const offered = KIND_PROFILES[input.kind].modules;
  const allowed: LaunchModuleKey[] = BOOKS_MODULES.filter((key) => {
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
    case 'retail':
      return input.route === 'indie'
        ? 'Retail sell-in is for a book a publisher sells to shops. Say if a publisher has it.'
        : null;
    case 'audio':
      return input.audio
        ? null
        : 'An audiobook section is for a launch with an audiobook. Say if there is one.';
    case 'schools':
      return input.readership === 'adult'
        ? 'Schools and libraries are for books for young readers. Say if this is one.'
        : null;
    default:
      return null;
  }
}

/** Who a beat is for: a route, an audiobook or young readers. A beat with none is for every launch. */
export type BeatFor = Route | 'audio' | 'young';

/** One step of a launch calendar. `platforms` here names who the beat is for (`BeatFor`). */
export type Beat = SharedBeat<BeatFor>;

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
   * Shares for a Budget split, labelled a starting split in the plan, by route. Amounts are computed
   * by code. TODO(verify): with a publisher and an indie author.
   */
  budget: Record<Route, readonly { line: string; share: number }[]>;
  /** Table cities that stand in for markets when the brief names none. Shown as Worth a look. */
  defaultCities: readonly string[];
}

const CATALOG_BEAT: Beat = {
  at: -26,
  until: -20,
  key: 'metadata',
  text: 'Lock the cover, the blurb, the categories and the keywords, and set the on-sale date. Check the categories against the comparable books.',
};

const publicBeats: readonly Beat[] = [
  {
    at: -24,
    until: -16,
    key: 'sell-in',
    text: 'Sell in to the retail buyers and wholesalers with the catalogue page, the cover and the comparable books. Ask for pre-order placement.',
    platforms: ['traditional'],
  },
  {
    at: -12,
    key: 'upload',
    text: 'Upload the files, set the pre-order and check the categories and keywords against the comparable books.',
    platforms: ['indie'],
  },
  {
    at: -20,
    key: 'advance-copies',
    text: 'Send advance copies, proofs or digital, to early reviewers, booksellers and the trade press. An indie author builds a team of advance readers the same way.',
  },
  {
    at: -12,
    until: -8,
    key: 'long-lead',
    text: 'Pitch the long-lead magazines, newspapers and literary supplements, and send finished copies where you have them.',
  },
  {
    at: -8,
    key: 'preorders',
    text: 'Open pre-orders everywhere and make the cover and an excerpt public.',
  },
  {
    at: -6,
    until: -2,
    key: 'events',
    text: 'Book the launch event, the bookshop signings and any festival slots, and confirm each one in writing.',
  },
  {
    at: -4,
    key: 'newsletter',
    text: 'Send the newsletter with the first chapter and the pre-order link, and give book clubs a reading kit.',
  },
  {
    at: -3,
    key: 'audiobook',
    text: 'Release the audiobook the same day as the book, with a sample on the retail page.',
    platforms: ['audio'],
  },
  {
    at: -3,
    until: -1,
    key: 'schools',
    text: 'Send teachers and librarians a free copy and a discussion guide, so the book is on a list before the launch.',
    platforms: ['young'],
  },
  {
    at: -2,
    key: 'creators',
    text: 'Send finished copies to the reviewers and creators who cover the genre, and schedule their posts for launch week.',
  },
  {
    at: 0,
    key: 'launch',
    text: 'Publication day: pre-orders ship, the launch event runs, and the press and the first round of reviews go out the same week.',
  },
  {
    at: 1,
    until: 4,
    key: 'reviews',
    text: 'Ask every reader you can reach for a rating and a review on the retail pages and Goodreads, and keep the events and posts coming.',
  },
  {
    at: 4,
    until: 12,
    key: 'first-read',
    text: 'Read the first sales and reviews by market and age band. Move advertising, events and restocks to where the book sells.',
  },
];

const debutBeats: readonly Beat[] = [CATALOG_BEAT, ...publicBeats];

const frontlistBeats: readonly Beat[] = [
  CATALOG_BEAT,
  {
    at: -12,
    key: 'earlier-readers',
    text: 'Tell the readers of the earlier books first: a note in the back of the earlier editions, a newsletter and a pre-order link.',
  },
  ...publicBeats,
];

const seriesBeats: readonly Beat[] = [
  {
    at: -16,
    key: 'earlier-readers',
    text: 'Tell the readers of the earlier books first: a note in the back of each, a newsletter and the pre-order link. They are the cheapest launch audience.',
  },
  {
    at: -8,
    until: -1,
    key: 'book-one',
    text: 'Put a price promotion on book one so a new reader can start the series, and point its page to the new book.',
  },
  ...publicBeats.filter((b) => b.key !== 'long-lead'),
];

const backlistBeats: readonly Beat[] = [
  {
    at: -16,
    key: 'new-edition',
    text: 'Lock the new cover, the new edition and its metadata, and re-send the catalogue page to the shops.',
  },
  {
    at: -12,
    until: -4,
    key: 'tie-in',
    text: 'If a screen adaptation is coming, plan the launch around its release date and ask the production for the key art and a quote.',
  },
  ...publicBeats.filter((b) => !['sell-in', 'long-lead', 'advance-copies'].includes(b.key)),
  {
    at: -10,
    key: 'sell-in-edition',
    text: 'Sell the new edition in to the retail buyers and ask for a front-of-store or promotion slot.',
    platforms: ['traditional'],
  },
];

const bookModules: readonly LaunchModuleKey[] = [
  'comps',
  'adaptation',
  'retail',
  'publicity',
  'events',
  'creators',
  'partnerships',
  'community',
  'audio',
  'schools',
];

const marketCities = ['New York', 'London', 'Toronto', 'Lagos', 'Sydney'];

export const KIND_PROFILES: Record<LaunchKind, KindProfile> = {
  debut: {
    label: 'Debut',
    short: 'debut',
    modules: [...bookModules, 'timeline', 'budget', 'measure', 'risks'],
    beats: debutBeats,
    measures: [
      'Pre-orders by market and age band',
      'First-week sales by market',
      'Ratings and reviews on the retail pages in the first month',
      'Where new readers came from: shop, event, creator or newsletter',
    ],
    budget: {
      traditional: [
        { line: 'Publicity, reviews and publicists', share: 0.25 },
        { line: 'Events, tour and festivals', share: 0.2 },
        { line: 'Advertising and discovery', share: 0.2 },
        { line: 'Retail promotion and pre-order support', share: 0.1 },
        { line: 'Creators and advance copies', share: 0.1 },
        { line: 'Book clubs and community', share: 0.05 },
        { line: 'Contingency', share: 0.1 },
      ],
      indie: [
        { line: 'Advertising on retail pages and social', share: 0.3 },
        { line: 'Advance copies and reviewers', share: 0.15 },
        { line: 'Newsletter swaps and promotions', share: 0.15 },
        { line: 'Publicity and reviews', share: 0.1 },
        { line: 'Events and signings', share: 0.1 },
        { line: 'Creators', share: 0.1 },
        { line: 'Contingency', share: 0.1 },
      ],
    },
    defaultCities: marketCities,
  },
  frontlist: {
    label: 'New book',
    short: 'new book',
    modules: [
      'comps',
      'retail',
      'publicity',
      'events',
      'adaptation',
      'creators',
      'community',
      'partnerships',
      'audio',
      'schools',
      'cadence',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: frontlistBeats,
    measures: [
      'Pre-orders against the author’s last book, by market and age band',
      'First-week sales by market',
      'How many readers of the earlier books bought this one',
      'Ratings and reviews on the retail pages in the first month',
    ],
    budget: {
      traditional: [
        { line: 'Publicity, reviews and publicists', share: 0.25 },
        { line: 'Events, tour and festivals', share: 0.15 },
        { line: 'Advertising to earlier readers and look-alikes', share: 0.25 },
        { line: 'Retail promotion and pre-order support', share: 0.1 },
        { line: 'Creators and advance copies', share: 0.1 },
        { line: 'Book clubs and community', share: 0.05 },
        { line: 'Contingency', share: 0.1 },
      ],
      indie: [
        { line: 'Advertising to earlier readers and look-alikes', share: 0.35 },
        { line: 'Advance copies and reviewers', share: 0.1 },
        { line: 'Newsletter swaps and promotions', share: 0.15 },
        { line: 'Publicity and reviews', share: 0.1 },
        { line: 'Events and signings', share: 0.05 },
        { line: 'Creators', share: 0.15 },
        { line: 'Contingency', share: 0.1 },
      ],
    },
    defaultCities: marketCities,
  },
  series: {
    label: 'Next book in a series',
    short: 'next book in a series',
    modules: [
      'comps',
      'cadence',
      'retail',
      'creators',
      'community',
      'publicity',
      'events',
      'adaptation',
      'audio',
      'partnerships',
      'schools',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: seriesBeats,
    measures: [
      'Pre-orders against the last book in the series, by market',
      'Sales of book one in the weeks around the launch',
      'Read-through: how many readers of book one buy this one',
      'Ratings and reviews on the retail pages in the first month',
    ],
    budget: {
      traditional: [
        { line: 'Advertising to earlier readers and look-alikes', share: 0.3 },
        { line: 'Retail promotion and the price promotion on book one', share: 0.15 },
        { line: 'Publicity and reviews', share: 0.15 },
        { line: 'Events and signings', share: 0.1 },
        { line: 'Creators and advance copies', share: 0.15 },
        { line: 'Book clubs and community', share: 0.05 },
        { line: 'Contingency', share: 0.1 },
      ],
      indie: [
        { line: 'Advertising to earlier readers and look-alikes', share: 0.4 },
        { line: 'Price promotions and newsletter swaps', share: 0.2 },
        { line: 'Creators and advance copies', share: 0.15 },
        { line: 'Publicity and reviews', share: 0.05 },
        { line: 'Community and reader groups', share: 0.1 },
        { line: 'Contingency', share: 0.1 },
      ],
    },
    defaultCities: marketCities,
  },
  backlist: {
    label: 'Reissue or new edition',
    short: 'reissue or new edition',
    modules: [
      'comps',
      'adaptation',
      'retail',
      'creators',
      'publicity',
      'cadence',
      'community',
      'events',
      'partnerships',
      'audio',
      'schools',
      'timeline',
      'budget',
      'measure',
      'risks',
    ],
    beats: backlistBeats,
    measures: [
      'Sales of the new edition against the last edition, by market',
      'Pre-orders around the screen release, if there is one',
      'Ratings and reviews of the new edition in the first month',
      'Where new readers came from: shop, event, creator or screen',
    ],
    budget: {
      traditional: [
        { line: 'Advertising and discovery', share: 0.3 },
        { line: 'Retail promotion and new edition support', share: 0.2 },
        { line: 'Publicity and the screen tie-in', share: 0.15 },
        { line: 'Creators', share: 0.15 },
        { line: 'Events and signings', share: 0.05 },
        { line: 'Book clubs and community', share: 0.05 },
        { line: 'Contingency', share: 0.1 },
      ],
      indie: [
        { line: 'Advertising and discovery', share: 0.4 },
        { line: 'Promotions and newsletter swaps', share: 0.2 },
        { line: 'Creators', share: 0.15 },
        { line: 'Publicity and the screen tie-in', share: 0.05 },
        { line: 'Community and reader groups', share: 0.1 },
        { line: 'Contingency', share: 0.1 },
      ],
    },
    defaultCities: marketCities,
  },
};

/** What a launch's beats are for: its route, an audiobook, young readers. */
export function beatTags(route: Route, audio: boolean, readership: Readership): BeatFor[] {
  return [
    route,
    ...(audio ? (['audio'] as const) : []),
    ...(readership === 'adult' ? [] : (['young'] as const)),
  ];
}

/** The beats for this launch, in calendar order: those with no audience, and those for its tags. */
export function beatsFor(kind: LaunchKind, tags: readonly BeatFor[]): Beat[] {
  return KIND_PROFILES[kind].beats
    .filter((b) => !b.platforms || b.platforms.some((p) => tags.includes(p)))
    .sort((a, b) => a.at - b.at);
}
