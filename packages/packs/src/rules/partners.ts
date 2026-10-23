import type { Category } from '@oraqul/schema';
import { type PartnerTier, teamRule } from './shared';
import type { Rule } from './types';

// Brand partnerships (T1 to T4). Qloo ranks brands; code decides the tier, the budget fit and the
// flags; the model never sets any of it. Nothing here is a price, and Oraqul never sends a pitch.

export interface BrandCategory {
  /** The phrase resolved to a Qloo brand tag, such as "beverage". */
  phrase: string;
  /**
   * True only once a live probe showed the category gives brands that operate in a city
   * (docs/backend/qloo.md). An unverified category is offered as a kind of partner and never asked.
   */
  verified: boolean;
}

export interface CategoryPartners {
  /** Brand categories Qloo is asked about for this category's audience, in order. */
  brandCategories: BrandCategory[];
  /** Kinds of tier B partner: brands that fit the category. */
  bKinds: string[];
  /** Kinds of tier C partner: local, and realistic for an independent release. */
  cKinds: string[];
  /** What a partner can get from the release through its own channels. */
  gets: string[];
  /** Concrete ideas to suggest, worded so the partner can shape them (T4). */
  ideas: string[];
}

export interface TierSeed {
  /** Names Qloo is asked to rank. A name Qloo does not rank shows as not ranked. */
  names: string[];
  /** Kinds of partner with no fixed name, named so the writer proposes real ones. */
  kinds: string[];
}

export const PARTNERS_VERSION = 'partners@2026-10-23.1';

const BEVERAGE: BrandCategory = { phrase: 'beverage', verified: true };
const TELECOM: BrandCategory = { phrase: 'telecom', verified: true };

// Unverified categories (apparel, beauty, food, coffee, hardware, energy, ticketing) are listed in
// `bKinds` only. They join `brandCategories` once a probe shows them (qloo.md).
export const CATEGORY_PARTNERS: Record<Exclude<Category, 'shows'>, Rule<CategoryPartners>> = {
  film: teamRule('partners.film', {
    brandCategories: [BEVERAGE, TELECOM],
    bKinds: ['food and drink', 'apparel', 'beauty', 'telecom bundles'],
    cKinds: ['cinemas', 'creators', 'community groups'],
    gets: [
      'a mention on the cinema ticket, the trailer end card and the premiere',
      'the film’s own channels and cast posts',
      'a screening or a premiere evening for its customers',
    ],
    ideas: [
      'a limited product or flavour tied to the film’s title',
      'a premiere evening hosted with the partner',
      'a ticket offer inside the partner’s app or stores',
    ],
  }),
  music: teamRule('partners.music', {
    brandCategories: [BEVERAGE, TELECOM],
    bKinds: ['drinks brands', 'telecom bundles', 'apparel'],
    cKinds: ['venues', 'creators', 'community groups'],
    gets: [
      'the artist’s own posts and stage mentions',
      'a branded moment at a launch event or a listening party',
      'content the partner can run on its own channels',
    ],
    ideas: [
      'a listening party hosted at the partner’s venue',
      'a limited drop, such as a can or a bundle, with the artwork',
      'a creator challenge the partner promotes to its customers',
    ],
  }),
  books: teamRule('partners.books', {
    brandCategories: [BEVERAGE],
    bKinds: ['coffee and lifestyle brands', 'stationery'],
    cKinds: ['bookshops', 'reading communities', 'libraries'],
    gets: [
      'a reading event in its own space',
      'a signed copy or a bookmark inside its own packaging',
      'author content it can run on its own channels',
    ],
    ideas: [
      'a reading and signing at the partner’s shop or café',
      'a reading-group pack handed out with a purchase',
      'a limited edition bookmark or sleeve',
    ],
  }),
  podcasts: teamRule('partners.podcasts', {
    brandCategories: [BEVERAGE, TELECOM],
    bKinds: ['sponsor brands that fit the listener profile', 'telecom bundles'],
    cKinds: ['creators', 'networks', 'community groups'],
    gets: [
      'a read in the episode and a mention in the show notes',
      'a segment or a live recording with its name on it',
      'clips it can run on its own channels',
    ],
    ideas: [
      'a themed episode or segment made with the partner',
      'a live recording hosted at the partner’s space',
      'a listener offer announced on the show',
    ],
  }),
  games: teamRule('partners.games', {
    brandCategories: [BEVERAGE, TELECOM],
    bKinds: ['hardware and peripherals', 'energy and snack brands', 'telecom bundles'],
    cKinds: ['streamers', 'creators', 'community groups'],
    gets: [
      'an in-game item or a store page mention',
      'a creator stream it can sponsor',
      'a tournament or a launch event with its name on it',
    ],
    ideas: [
      'a limited in-game item or skin themed with the partner',
      'a creator stream with the partner’s hardware on screen',
      'a pack or code inside the partner’s product',
    ],
  }),
};

/** Seed partners per market and tier. Seeds are asked of Qloo only for markets the plan reaches. */
const SEEDS = teamRule<Record<string, Record<PartnerTier, TierSeed>>>('partners.seeds', {
  nigeria: {
    // TODO(verify): Guinness, Indomie, Verve and QuickTeller have not been resolved in Qloo yet.
    A: { names: ['Guinness', 'MTN', 'Indomie'], kinds: [] },
    B: {
      names: ['Verve', 'QuickTeller'],
      kinds: ['food and drink', 'hospitality', 'telecom bundles'],
    },
    C: { names: [], kinds: ['cinemas', 'creators', 'diaspora businesses', 'community groups'] },
  },
  'united kingdom': {
    A: { names: [], kinds: [] },
    B: { names: ['EE', 'Monzo'], kinds: [] },
    C: { names: [], kinds: ['independent cinemas', 'creators', 'diaspora businesses'] },
  },
  'united states': {
    A: { names: [], kinds: [] },
    B: { names: ['Lyft', 'Cash App'], kinds: [] },
    C: { names: [], kinds: ['independent cinemas', 'creators', 'diaspora businesses'] },
  },
});

/** T1 to T4 and the tier rule, each with its source. */
export const PARTNER_RULES = {
  version: PARTNERS_VERSION,
  seeds: SEEDS,
  /**
   * A tier by what Qloo says about a brand, not by default. A flagship seed is tier A; so is a
   * ranked brand at or above this popularity (0 to 1), the top of the band the brand query uses.
   */
  tier: teamRule('partners.tier', { flagshipPopularity: 0.85 }),
  /** Options kept per tier, so the many ranked brands cannot push the local partners out. */
  slots: teamRule<Record<PartnerTier, number>>('partners.slots', { A: 3, B: 7, C: 4 }),
  /** T1. Big brands plan a year or more ahead, so an independent release starts with tiers B and C. */
  leadTime: teamRule('partners.lead-time', {
    months: 18,
    why: 'Big brands plan annually, and specialists advise starting about 18 months before release. Big franchises attract the big brands.',
    independent:
      'An independent release usually has no franchise behind it, so lead with tier B and tier C partners.',
    barter:
      'Barter and in-kind deals are common: a venue, product or reach in place of cash. Never assume a cash sponsorship.',
  }),
  /** T2. Words that mark a mismatch between the work and a partner, flagged by code and never a drop. */
  contentFit: teamRule('partners.content-fit', {
    family: ['family', 'kids', 'children'],
    adult: ['violent', 'violence', 'horror', 'adult', 'explicit', 'gore', 'mature'],
    ratings: ['R', 'NC-17', 'TV-MA', '18', '18+', 'M'],
    alcohol: ['beverage', 'drinks brands', 'drinks brand', 'Guinness'],
    youngAges: ['24_and_younger'],
  }),
  /** T3 and T4. The parts of a pitch, and the room the pitch leaves the partner. */
  pitch: teamRule('partners.pitch', {
    parts: ['fit', 'gets', 'ask', 'timeline', 'ideas', 'script'],
    room: 'These are starting ideas. Ask the partner what they would build, and leave the creative open to them.',
  }),
};

export const FLAGSHIPS: string[] = [
  ...new Set(Object.values(SEEDS.value).flatMap((tiers) => tiers.A.names)),
];

/** Seeds for a market, by lower-case country name. */
export const PARTNER_SEEDS = SEEDS.value;

/** The brand categories Qloo may be asked for a category: only the probe-verified ones. */
export function brandCategoriesFor(category: Exclude<Category, 'shows'>): string[] {
  return CATEGORY_PARTNERS[category].value.brandCategories
    .filter((c) => c.verified)
    .map((c) => c.phrase);
}
