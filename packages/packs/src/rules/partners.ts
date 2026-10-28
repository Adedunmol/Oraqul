import type { Category, MoneyType } from '@oraqul/schema';
import { type LauncherKind, type PartnerTier, teamRule } from './shared';
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
  /** What the probe of 2026-10-23 found, for a category that is not verified. */
  note?: string;
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
// Probed live 2026-10-23 with an artist signal in Lagos and London (qloo-partner-probes).
const FOOD: BrandCategory = { phrase: 'food', verified: true };
const BEAUTY: BrandCategory = { phrase: 'beauty', verified: true };
const COFFEE: BrandCategory = {
  phrase: 'coffee',
  verified: false,
  note: 'Returned global tea and coffee brands in Lagos and London, not ones that operate there.',
};
const ENERGY: BrandCategory = {
  phrase: 'energy drink',
  verified: false,
  note: 'One brand in Lagos and none in London.',
};
const SNACK: BrandCategory = {
  phrase: 'snack',
  verified: false,
  note: 'One brand in Lagos, and mostly US brands in London.',
};

// Qloo has no brand category for apparel, hardware, ticketing, payments or banks, so those are kinds
// of partner with no Qloo call. An unverified category stays listed with its probe note.
export const CATEGORY_PARTNERS: Record<Category, Rule<CategoryPartners>> = {
  film: teamRule('partners.film', {
    brandCategories: [TELECOM, BEVERAGE, FOOD, BEAUTY],
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
    brandCategories: [TELECOM, BEVERAGE, BEAUTY],
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
    brandCategories: [BEVERAGE, TELECOM, FOOD, COFFEE],
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
    brandCategories: [BEVERAGE, TELECOM, FOOD],
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
  shows: teamRule('partners.shows', {
    // Probed live 2026-10-23: ticketing and payments have no brand tag in Qloo, so they are kinds.
    brandCategories: [BEVERAGE, TELECOM],
    bKinds: ['title sponsor', 'drinks brand', 'ticketing and payments partner'],
    cKinds: ['venue', 'creators', 'community groups'],
    gets: [
      'its name on the show page, the tickets and the stage or screen',
      'a moment at the show, such as a bar, a stand or an announcement',
      'content it can run on its own channels',
    ],
    ideas: [
      'a presale or a ticket offer for the partner’s own customers',
      'a branded bar or lounge at the venue on the night',
      'a limited drop sold only at the show',
    ],
  }),
  games: teamRule('partners.games', {
    brandCategories: [BEVERAGE, TELECOM, ENERGY, SNACK],
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
    // Probed live 2026-10-23: Guinness, Indomie and Bolt match by exact name, and MTN matches as
    // "MTN Group". Verve and QuickTeller did not resolve to the Nigerian payment brands ("Verve"
    // found a coffee roaster, "QuickTeller" nothing), so they are a kind of partner, not a name.
    A: { names: ['Guinness', 'MTN', 'Indomie'], kinds: [] },
    B: {
      names: ['Bolt'],
      kinds: ['banks and payment brands', 'food and drink', 'hospitality', 'telecom bundles'],
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
  /**
   * Who is launching, beside the band: what each can realistically approach, said in the plan's
   * notes. The reach itself is `partnerReach` in `shared.ts`.
   */
  reach: teamRule<Record<LauncherKind, string>>('partners.reach', {
    solo: 'A solo launch has no company behind it, so brands do not take it on as a partner. Lead with local partners and in-kind help, and leave out national brands.',
    small:
      'A small team can land category brands and local businesses by offering reach or content in return. National brands are a stretch.',
    established:
      'An established company can approach category brands, and a flagship brand is a stretch worth one pitch.',
    major: 'A major release can approach flagship brands as well as category and local partners.',
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

/**
 * What a partner could give, from what it is. A named brand is in kind: "Never assume a cash
 * sponsorship" (T1). A kind of partner is read from its name, so a cinema is placement and a
 * radio station is media. Never cash from a guess.
 */
export function moneyTypeOf(input: { kind: 'brand' | 'kind'; name: string }): MoneyType {
  if (input.kind === 'brand') return 'in_kind';
  const n = input.name.toLowerCase();
  if (
    /\b(ticket|screening|giveaway|premiere|community group|club|society|church|school|university)\b/.test(
      n,
    )
  ) {
    return 'bulk_tickets';
  }
  if (
    /\b(radio|tv|television|newspaper|magazine|blog|podcast|press|media|billboard|ad space|airtime)\b/.test(
      n,
    )
  ) {
    return 'media';
  }
  if (
    /\b(cinema|venue|theatre|theater|screen|bookshop|bookstore|shop|store|hotel|restaurant|bar|cafe)\b/.test(
      n,
    )
  ) {
    return 'placement';
  }
  return 'in_kind';
}

export const FLAGSHIPS: string[] = [
  ...new Set(Object.values(SEEDS.value).flatMap((tiers) => tiers.A.names)),
];

/** Seeds for a market, by lower-case country name. */
export const PARTNER_SEEDS = SEEDS.value;

/** The brand categories Qloo may be asked for a category: only the probe-verified ones. */
export function brandCategoriesFor(category: Category): string[] {
  return CATEGORY_PARTNERS[category].value.brandCategories
    .filter((c) => c.verified)
    .map((c) => c.phrase);
}
