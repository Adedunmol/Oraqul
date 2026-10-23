import {
  BAND_LABEL,
  BAND_OPTIONS,
  budgetBands,
  COUNTRY_CHANNELS,
  rules,
  TIER_LABEL,
} from '@oraqul/packs';
import { categories, type RulesResponse } from '@oraqul/schema';

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
  };
}
