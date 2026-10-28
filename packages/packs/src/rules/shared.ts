import {
  type BudgetBand,
  budgetBands,
  type LauncherKind,
  type PartnerTier as SchemaTier,
  TIER_LABEL,
} from '@oraqul/schema';
import type { Rule, RuleSource } from './types';

export { type BudgetBand, budgetBands, type LauncherKind, TIER_LABEL };

/** Launch craft Oraqul's team set. Dated so a reader can tell how old a rule is. */
export const TEAM_RULE: RuleSource = {
  kind: 'team',
  label: 'Oraqul team rule',
  date: '2026-10-22',
  grade: 'team',
};

export const teamRule = <T>(id: string, value: T): Rule<T> => ({ id, value, source: TEAM_RULE });

// Budget bands. The thresholds are chosen conventions, not measured, and are the first thing to
// change if the bands feel wrong. A budget in another currency is read as the nearest listed one.
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

export type PartnerTier = SchemaTier;

export type PartnerReach = 'fits' | 'stretch' | 'out';

/**
 * How realistic a tier is for who is launching and what they can spend; the lower of the two
 * wins. A flagship is out for a solo launcher whatever the budget, and for anyone on a micro
 * budget. On an independent budget only an established or major launcher can stretch to one. A
 * launcher the brief does not describe is treated as unknown: only the band decides.
 */
export function partnerReach(
  band: BudgetBand,
  tier: PartnerTier,
  launcher: LauncherKind | null = null,
): PartnerReach {
  if (tier === 'C') return 'fits';
  if (tier === 'B') return band === 'micro' || launcher === 'solo' ? 'stretch' : 'fits';
  if (launcher === 'solo' || band === 'micro') return 'out';
  if (band === 'independent') {
    return launcher === 'established' || launcher === 'major' ? 'stretch' : 'out';
  }
  return launcher === 'small' ? 'stretch' : 'fits';
}

/** Whether a line may propose a partner of this tier: only a clear fit, never a stretch. */
export function bandCarries(
  band: BudgetBand,
  tier: PartnerTier,
  launcher: LauncherKind | null = null,
): boolean {
  return tier !== 'A' || partnerReach(band, tier, launcher) === 'fits';
}

/** Diaspora hubs by country of origin, in the order a rollout reaches them. */
export const DIASPORA: Record<string, string[]> = {
  nigeria: ['London', 'Houston', 'Atlanta', 'Toronto'],
  ghana: ['London', 'New York', 'Toronto'],
  'south africa': ['London', 'Sydney'],
  jamaica: ['London', 'New York', 'Toronto'],
  india: ['London', 'Toronto', 'Dubai'],
  'south korea': ['Los Angeles', 'New York'],
};

/**
 * Channels that lead where a market's audience is, ahead of the category's own order. WhatsApp is
 * never one: it spreads a launch between people who know each other, so it is a sharing layer.
 */
export const COUNTRY_CHANNELS: Record<string, string[]> = {
  nigeria: ['Instagram', 'TikTok'],
};

/** Words that offer to make the asset itself, which Oraqul never does (a person makes it). */
export const ASSET_OFFER =
  /\b(?:(?:i|we|oraqul)(?:'ll| will| can)?\s+(?:generate|render|produce|create|make|design|edit)|(?:generated|ai[- ]made|ai[- ]generated))\b[^.]{0,60}\b(?:ads?|trailers?|posters?|images?|videos?|clips?|artwork|key art)\b/i;

/**
 * Multi word names a grounded line may use without a finding behind them: the platforms and
 * services every launch plan talks about. Any other name in a grounded line has to be in a finding
 * it cites, in the brief or on a page it cites.
 */
export const LAUNCH_TERMS = [
  'Instagram Reels',
  'Instagram Stories',
  'YouTube Shorts',
  'Apple Music',
  'Apple Podcasts',
  'Google Play',
  'App Store',
  'Amazon Prime',
  'Prime Video',
  'Spotify for Artists',
  'Black Friday',
];

export const SHARED_VERSION = 'shared@2026-10-23.1';

/**
 * The conventions every category shares, each with its source and the library version a plan
 * records. The bands and the hubs are chosen conventions, not measured.
 */
export const SHARED_RULES = {
  version: SHARED_VERSION,
  bands: teamRule('shared.bands', BAND_EDGES),
  diaspora: teamRule('shared.diaspora', DIASPORA),
  countryChannels: teamRule('shared.country-channels', COUNTRY_CHANNELS),
};
