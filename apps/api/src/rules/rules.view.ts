import {
  BAND_LABEL,
  BAND_OPTIONS,
  budgetBands,
  CALENDAR_RULES,
  CATEGORY_EXTRAS,
  CATEGORY_PARTNERS,
  COUNTRY_CHANNELS,
  MARKET_EXTRAS,
  OPPORTUNITY_RULES,
  PACE_RULES,
  PACE_THRESHOLDS,
  PACE_VERSION,
  PARTNER_RULES,
  rules,
  SHARED_RULES,
  SHOWS_PLAN_RULES,
  TIER_LABEL,
  WATCH_RULES,
  WATCH_VERSION,
} from '@oraqul/packs';
import { categories, type RulesResponse } from '@oraqul/schema';

const mapEdges = (edges: Record<string, readonly number[]>): Record<string, number[]> =>
  Object.fromEntries(Object.entries(edges).map(([k, v]) => [k, [...v]]));

/** The rule library as the API serves it: static, public, and the same for every team. */
export function rulesView(): RulesResponse {
  return {
    libraries: categories.map((category) => {
      const lib = rules[category];
      return {
        category,
        version: lib.version,
        timeline: lib.timeline,
        beats: lib.beats.map(({ at, until, key, text }) => ({ at, until, key, text })),
        signal: lib.signal,
        channels: lib.channels,
      };
    }),
    bands: budgetBands.map((id) => ({ id, label: BAND_LABEL[id], description: BAND_OPTIONS[id] })),
    tiers: (['A', 'B', 'C'] as const).map((tier) => ({ tier, ...TIER_LABEL[tier] })),
    countryChannels: COUNTRY_CHANNELS,
    shared: {
      version: SHARED_RULES.version,
      bandEdges: { ...SHARED_RULES.bands, value: mapEdges(SHARED_RULES.bands.value) },
      diaspora: SHARED_RULES.diaspora,
      countryChannels: SHARED_RULES.countryChannels,
      platformsByCategory: CATEGORY_EXTRAS,
      platformsByMarket: MARKET_EXTRAS,
    },
    partners: {
      version: PARTNER_RULES.version,
      categories: CATEGORY_PARTNERS,
      seeds: PARTNER_RULES.seeds,
      tier: PARTNER_RULES.tier,
      slots: PARTNER_RULES.slots,
      leadTime: PARTNER_RULES.leadTime,
      pitch: PARTNER_RULES.pitch,
    },
    shows: {
      version: SHOWS_PLAN_RULES.version,
      rules: Object.fromEntries(
        Object.entries(SHOWS_PLAN_RULES).flatMap(([key, value]) =>
          typeof value === 'object' && 'source' in value ? [[key, value]] : [],
        ),
      ),
    },
    calendar: {
      version: CALENDAR_RULES.version,
      categories: CALENDAR_RULES.categories,
      ads: CALENDAR_RULES.ads,
    },
    pace: { version: PACE_VERSION, thresholds: PACE_THRESHOLDS, rules: PACE_RULES },
    watch: { version: WATCH_VERSION, rules: WATCH_RULES },
    opportunities: {
      version: OPPORTUNITY_RULES.version,
      kinds: OPPORTUNITY_RULES.kinds,
    },
  };
}
