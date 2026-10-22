import type { Rule, RuleSource } from './types';

/** Launch craft Oraqul's team set. Dated so a reader can tell how old a rule is. */
export const TEAM_RULE: RuleSource = {
  kind: 'team',
  label: 'Oraqul team rule',
  date: '2026-10-22',
};

export const teamRule = <T>(id: string, value: T): Rule<T> => ({ id, value, source: TEAM_RULE });

// Budget bands. The thresholds are chosen conventions, not measured, and are the first thing to
// change if the bands feel wrong. A budget in another currency is read as the nearest listed one.
export const budgetBands = ['micro', 'independent', 'mid', 'major'] as const;
export type BudgetBand = (typeof budgetBands)[number];

export const BAND_LABEL: Record<BudgetBand, string> = {
  micro: 'Micro',
  independent: 'Independent',
  mid: 'Mid-size',
  major: 'Major',
};

/** Upper edge of each band but the last, per currency. */
export const BAND_EDGES: Record<string, readonly [number, number, number]> = {
  USD: [10_000, 100_000, 1_000_000],
  GBP: [8_000, 80_000, 800_000],
  EUR: [9_000, 90_000, 900_000],
  NGN: [15_000_000, 150_000_000, 1_500_000_000],
};

/** What the person sees on the band card. */
export const BAND_OPTIONS: Record<BudgetBand, string> = {
  micro: 'Micro: under about $10k',
  independent: 'Independent: up to about $100k',
  mid: 'Mid-size: up to about $1M',
  major: 'Major: over $1M',
};

export function bandOf(amount: number, currency: string): BudgetBand {
  const edges = BAND_EDGES[currency.toUpperCase()] ?? BAND_EDGES.USD;
  if (!edges) return 'independent';
  if (amount < edges[0]) return 'micro';
  if (amount < edges[1]) return 'independent';
  if (amount < edges[2]) return 'mid';
  return 'major';
}

export type PartnerTier = 'A' | 'B' | 'C';

/** Flagship partners ask for scale, so only a mid-size or major release is offered them. */
export function bandCarries(band: BudgetBand, tier: PartnerTier): boolean {
  return tier !== 'A' || band === 'mid' || band === 'major';
}

export const TIER_LABEL: Record<PartnerTier, { name: string; what: string }> = {
  A: { name: 'Flagship', what: 'Big national brands. Only for releases with scale.' },
  B: {
    name: 'Category and integration',
    what: 'Banks and payment brands, food and drink, hospitality, telecom bundles.',
  },
  C: {
    name: 'Local',
    what: 'Cinemas, creators, diaspora businesses and community groups. Most realistic for an independent release.',
  },
};

export interface TierSeed {
  /** Names Qloo is asked to rank. A name Qloo does not rank shows as not ranked. */
  names: string[];
  /** Kinds of partner with no fixed name, named so the writer proposes real ones. */
  kinds: string[];
}

/**
 * Seed partners per market and tier. Only the names the docs record as verified live are marked
 * so; the rest wait on a live check (qloo.md).
 */
export const PARTNER_SEEDS: Record<string, Record<PartnerTier, TierSeed>> = {
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
};

/** Diaspora hubs by country of origin, in the order a rollout reaches them. */
export const DIASPORA: Record<string, string[]> = {
  nigeria: ['London', 'Houston', 'Atlanta', 'Toronto'],
  ghana: ['London', 'New York', 'Toronto'],
  'south africa': ['London', 'Sydney'],
  jamaica: ['London', 'New York', 'Toronto'],
  india: ['London', 'Toronto', 'Dubai'],
  'south korea': ['Los Angeles', 'New York'],
};

/** Channels that lead where a market's audience is, ahead of the category's own order. */
export const COUNTRY_CHANNELS: Record<string, string[]> = {
  nigeria: ['WhatsApp', 'Instagram'],
};

/** Words that offer to make the asset itself, which Oraqul never does (a person makes it). */
export const ASSET_OFFER =
  /\b(?:(?:i|we|oraqul)(?:'ll| will| can)?\s+(?:generate|render|produce|create|make|design|edit)|(?:generated|ai[- ]made|ai[- ]generated))\b[^.]{0,60}\b(?:ads?|trailers?|posters?|images?|videos?|clips?|artwork|key art)\b/i;
