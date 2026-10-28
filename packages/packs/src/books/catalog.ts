import type { LaunchModuleKey, LaunchSectionKey } from '@oraqul/schema';

// The Books query catalog (spec §4.5). The model picks from these and fills in their context; code
// runs them, within the call budget, and turns each result into a finding.
// Verified live on one literary fiction brief and one romantasy brief, with
// `qloo-books-probes.ts` (docs/backend/qloo.md). Other genres and markets are not probed one by one; thin data shows as a gap.

export const booksQueryKeys = [
  'audience',
  'markets',
  'themes',
  'shelf',
  'bridge',
  'podcasts',
  'brands',
  'bookshops',
  'creators',
] as const;
export type BooksQueryKey = (typeof booksQueryKeys)[number];

export interface BooksQuerySpec {
  key: BooksQueryKey;
  /** `core` queries run for every plan; the others only when their module is in it. */
  for: 'core' | LaunchModuleKey;
  /** Sections whose lines usually cite it. Any line may cite any finding. */
  feeds: LaunchSectionKey[];
  /** For the chat trace, as "Asking Qloo about …". */
  label: string;
}

export const BOOKS_QUERIES: Record<BooksQueryKey, BooksQuerySpec> = {
  audience: {
    key: 'audience',
    for: 'core',
    feeds: ['audience', 'bottom-line'],
    label: "the book's readers by age and gender",
  },
  markets: {
    key: 'markets',
    for: 'core',
    feeds: ['markets', 'bottom-line', 'events'],
    label: 'where in your markets those readers are strongest',
  },
  themes: {
    key: 'themes',
    for: 'core',
    feeds: ['positioning'],
    label: 'the themes those readers care about',
  },
  shelf: {
    key: 'shelf',
    for: 'comps',
    feeds: ['comps', 'positioning', 'bottom-line'],
    label: 'the recent books those readers pick up',
  },
  bridge: {
    key: 'bridge',
    for: 'adaptation',
    feeds: ['adaptation', 'bottom-line'],
    label: 'the series and films those readers also watch',
  },
  podcasts: {
    key: 'podcasts',
    for: 'publicity',
    feeds: ['publicity', 'adaptation'],
    label: 'the podcasts those readers hear',
  },
  brands: {
    key: 'brands',
    for: 'partnerships',
    feeds: ['partnerships'],
    label: 'the brands those readers use',
  },
  bookshops: {
    key: 'bookshops',
    for: 'events',
    feeds: ['events', 'retail'],
    label: 'the bookshops those readers go to',
  },
  creators: {
    key: 'creators',
    for: 'creators',
    feeds: ['creators'],
    label: 'the people those readers follow',
  },
};

/** Tag namespaces each query's phrases must resolve into, and the parent type for brands. */
export const TAG_SPACES = {
  // A book genre phrase resolves into `urn:tag:genre:media`: literary fiction, romance, fantasy,
  // thriller, young adult, memoir, self help and the rest were checked live.
  bookGenre: { prefix: 'urn:tag:genre:media', parent: null },
  brands: { prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
  bookshop: { prefix: 'urn:tag:category:place', parent: null },
} as const;

/** The place phrase that resolves to Qloo's bookshop category. */
export const BOOKSHOP_PHRASE = 'book store';

/** A book genre phrase by the words a brief uses for the book. The first match wins. */
export const GENRE_PHRASES: { match: RegExp; phrase: string }[] = [
  { match: /romantasy|fantasy romance|romantic fantasy/i, phrase: 'fantasy romance' },
  { match: /romance|rom-?com|love story/i, phrase: 'romance' },
  { match: /young adult|\bya\b|teen\w*/i, phrase: 'young adult' },
  { match: /children|picture book|middle[- ]grade|early reader|\bkids?\b/i, phrase: 'children' },
  { match: /science fiction|sci-?fi|dystopi\w*|space opera/i, phrase: 'science fiction' },
  { match: /fantasy|dragons?|\bmagic\w*|epic quest/i, phrase: 'fantasy' },
  { match: /horror|haunt\w*|gothic/i, phrase: 'horror' },
  { match: /true crime/i, phrase: 'true crime' },
  { match: /thriller|suspense|psychological/i, phrase: 'thriller' },
  { match: /mystery|whodunit|detective|cozy/i, phrase: 'mystery' },
  { match: /historical/i, phrase: 'historical fiction' },
  { match: /literary|novel of ideas|booker/i, phrase: 'literary fiction' },
  { match: /african|nigerian|ghanaian|kenyan|afro\w*|diaspora/i, phrase: 'african literature' },
  { match: /memoir|autobiograph/i, phrase: 'memoir' },
  { match: /biograph/i, phrase: 'biography' },
  {
    match: /self[- ]help|personal development|habits|mindset|productivity|wellness/i,
    phrase: 'self help',
  },
  { match: /business|entrepreneur|leadership|money|finance|invest\w*|career/i, phrase: 'business' },
  { match: /poetry|poems?|poet\b/i, phrase: 'poetry' },
  { match: /graphic novel|comics?|manga/i, phrase: 'graphic novels' },
  { match: /cookbook|recipes?/i, phrase: 'cookbooks' },
  { match: /faith|spiritual|religio\w*/i, phrase: 'religion' },
  { match: /non-?fiction|history|science|politics|essays?|narrative/i, phrase: 'non fiction' },
];

/** The genre phrase for the words in a brief, or null. */
export function genrePhrase(words: string): string | null {
  return GENRE_PHRASES.find((g) => g.match.test(words))?.phrase ?? null;
}

/** Books a shelf lists, at most, once the books of the anchors' own series are left out. */
export const SHELF_BOOKS = 6;

/** How many years back a shelf book may have been published. Recent comps are the ones to pitch. */
export const SHELF_YEARS = 5;

/** Titles of one medium a bridge scores in one call, at most. */
export const BRIDGE_PER_MEDIUM = 6;

/** Podcasts a publicity list keeps, at most. */
export const PODCASTS_SHOWN = 4;

/** Bookshops a city lists, at most. */
export const BOOKSHOPS_SHOWN = 5;

/**
 * Whether the people Qloo returns for a book signal are creators or authors worth approaching. The
 * live probe returned authors for a literary fiction audience but voice actors and narrators for a
 * fantasy romance one, so the list does not fit across genres. False until a list with context
 * fits. While false, the Creators section is playbook and Gaps says creators were not measured.
 */
export const CREATORS_GROUNDED = false;

/**
 * The table cities a region word stands for, so a brief that says "Europe and West Africa" gets
 * cities Qloo can rank. Keys are lower case.
 */
export const REGION_CITIES: Record<string, readonly string[]> = {
  'north america': ['New York', 'Toronto', 'Los Angeles'],
  us: ['New York', 'Los Angeles', 'Chicago', 'Atlanta'],
  usa: ['New York', 'Los Angeles', 'Chicago', 'Atlanta'],
  'united states': ['New York', 'Los Angeles', 'Chicago', 'Atlanta'],
  america: ['New York', 'Los Angeles', 'Chicago', 'Atlanta'],
  canada: ['Toronto', 'Vancouver'],
  'latin america': ['São Paulo', 'Mexico City'],
  brazil: ['São Paulo'],
  europe: ['London', 'Berlin', 'Paris', 'Amsterdam', 'Madrid'],
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
