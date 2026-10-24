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

/**
 * Well known books to describe an audience with when the brief names none and the model proposes
 * none, so a short description is enough to plan from. The first rule whose words match the brief
 * wins; the last rule is the default. Qloo finds each by name, or stands in the nearest book it
 * has, and the plan labels them as added by Oraqul. Each name is the name Qloo lists (checked on
 * the live host), which for a book in a series includes the series mark. Recheck the names now
 * and then.
 */
export const FALLBACK_COMPS: { match: RegExp; names: readonly string[] }[] = [
  {
    match: /romantasy|fantasy romance|fantasy|dragons?|\bmagic\w*/i,
    names: [
      'Fourth Wing (The Empyrean, #1)',
      'A Court of Thorns and Roses (A Court of Thorns and Roses, #1)',
      'The Name of the Wind (The Kingkiller Chronicle, #1)',
      "Harry Potter and the Sorcerer's Stone",
    ],
  },
  {
    match: /romance|rom-?com|love story/i,
    names: [
      'Beach Read',
      'It Ends with Us (It Ends with Us, #1)',
      'The Seven Husbands of Evelyn Hugo',
      'Normal People',
    ],
  },
  {
    match: /young adult|\bya\b|teen\w*/i,
    names: [
      'The Hunger Games (The Hunger Games, #1)',
      'Divergent (Divergent, #1)',
      "Harry Potter and the Sorcerer's Stone",
      'Wonder',
    ],
  },
  {
    match: /children|picture book|middle[- ]grade|early reader|\bkids?\b/i,
    names: [
      'Wonder',
      "Harry Potter and the Sorcerer's Stone",
      'The Lightning Thief (Percy Jackson and the Olympians, #1)',
    ],
  },
  {
    match: /science fiction|sci-?fi|dystopi\w*|space opera/i,
    names: [
      'Dune (Dune, #1)',
      'Project Hail Mary',
      'The Martian',
      'The Hunger Games (The Hunger Games, #1)',
    ],
  },
  {
    match: /thriller|suspense|psychological|mystery|whodunit|detective|crime/i,
    names: ['Gone Girl', 'The Silent Patient', 'The Girl on the Train', 'Where the Crawdads Sing'],
  },
  {
    match: /horror|haunt\w*|gothic/i,
    names: ['The Shining (The Shining, #1)', 'Gone Girl', 'The Silent Patient'],
  },
  {
    match: /memoir|autobiograph|biograph/i,
    names: ['Educated', 'Becoming', 'Born a Crime: Stories From a South African Childhood'],
  },
  {
    match:
      /self[- ]help|personal development|habits|mindset|productivity|business|entrepreneur|leadership|money|finance/i,
    names: [
      'Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones',
      'The Subtle Art of Not Giving a F*ck: A Counterintuitive Approach to Living a Good Life',
      'Sapiens: A Brief History of Humankind',
      'Rich Dad, Poor Dad',
    ],
  },
  {
    match: /non-?fiction|history|science|politics|essays?/i,
    names: [
      'Sapiens: A Brief History of Humankind',
      'Educated',
      'Born a Crime: Stories From a South African Childhood',
      'Becoming',
    ],
  },
  {
    match: /african|nigerian|ghanaian|kenyan|afro\w*|diaspora/i,
    names: [
      'Americanah',
      'Half of a Yellow Sun',
      'Purple Hibiscus',
      'Things Fall Apart (The African Trilogy, #1)',
    ],
  },
  {
    match: /historical/i,
    names: ['Pachinko', 'Half of a Yellow Sun', 'Pride and Prejudice', 'Where the Crawdads Sing'],
  },
  {
    match: /literary|novel/i,
    names: ['Normal People', 'Americanah', 'Where the Crawdads Sing', 'Educated'],
  },
  {
    match: /./,
    names: ['Where the Crawdads Sing', 'Educated', 'Gone Girl', 'Normal People'],
  },
];

/** Books to describe the audience with, from what the brief says about the book. */
export function fallbackComps(words: string, max = 4): string[] {
  const rule = FALLBACK_COMPS.find((r) => r.match.test(words));
  return (rule?.names ?? []).slice(0, max);
}

/**
 * Series and films to score for a bridge when the brief names none and the model proposes none.
 * Qloo's open lists of series and films for a book audience drift (documentaries and indie dramas,
 * checked live), so the bridge ranks titles we choose, as it ranks brands. Each is a title Qloo
 * finds by exact name. The first rule that matches wins.
 */
export const SCREEN_CANDIDATES: {
  match: RegExp;
  series: readonly string[];
  films: readonly string[];
}[] = [
  {
    match: /romantasy|fantasy|dragons?|\bmagic\w*|science fiction|sci-?fi|dystopi\w*/i,
    series: ['The Witcher', 'Shadow and Bone', 'The Wheel of Time', 'House of the Dragon'],
    films: ['The Hunger Games', 'The Martian'],
  },
  {
    match: /romance|rom-?com|love story/i,
    series: ['Bridgerton', 'Virgin River', 'Outlander', 'Emily in Paris'],
    films: ['It Ends with Us', 'Pride & Prejudice', 'Crazy Rich Asians'],
  },
  {
    match: /young adult|\bya\b|teen\w*|children|middle[- ]grade|kids?/i,
    series: ['Heartstopper', 'Percy Jackson and the Olympians', 'Shadow and Bone'],
    films: ['The Hunger Games', 'Wonder'],
  },
  {
    match: /thriller|suspense|psychological|mystery|crime|horror/i,
    series: ['You', 'Big Little Lies', 'Sharp Objects'],
    films: ['Gone Girl', 'Where the Crawdads Sing'],
  },
  {
    // A book with no story to adapt has no default screen title: the model proposes some, or the
    // team names them, and the bridge then shows the podcasts alone.
    match:
      /memoir|biograph|autobiograph|self[- ]help|personal development|habits|mindset|productivity|business|entrepreneur|leadership|money|finance|non-?fiction|history|science|politics|essays?|poetry|poems?|cookbook|recipes?|faith|spiritual|religio\w*/i,
    series: [],
    films: [],
  },
  {
    match: /./,
    series: ['Conversations with Friends', 'Little Fires Everywhere', 'Big Little Lies', 'You'],
    films: ['Where the Crawdads Sing', 'Crazy Rich Asians'],
  },
];

/** Screen titles to score for a bridge, from what the brief says about the book. */
export function screenCandidates(words: string): { series: string[]; films: string[] } {
  const rule = SCREEN_CANDIDATES.find((r) => r.match.test(words));
  return { series: [...(rule?.series ?? [])], films: [...(rule?.films ?? [])] };
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
