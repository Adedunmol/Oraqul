import type { LaunchModuleKey } from '@oraqul/schema';
import { SECTION_TITLES as SHARED_TITLES } from '../launch';

export { TASTE_CLAIM } from '../launch';

/** Section titles for a Music plan: the shared ones, reworded where music says it differently. */
export const SECTION_TITLES = {
  ...SHARED_TITLES,
  markets: 'Cities',
  publicity: 'Press and playlists',
  sync: 'Sync and placement',
} as const;

/** The modules a Music plan can carry, in order. */
export const MUSIC_MODULES = [
  'partnerships',
  'publicity',
  'community',
  'tour',
  'support',
  'sync',
  'timeline',
  'budget',
  'measure',
  'risks',
] as const satisfies readonly LaunchModuleKey[];

export type ReleaseType = 'single' | 'ep' | 'album' | 'tour';

export interface ModuleInput {
  scope: 'full' | 'narrow';
  /** The module a narrow ask names. Null when it names only core sections, such as cities. */
  ask: LaunchModuleKey | null;
  releaseType: ReleaseType | null;
  /** How many cities the team named. */
  cities: number;
  hasBudget: boolean;
}

export interface ModulePick {
  modules: LaunchModuleKey[];
  /** Modules the brief rules out, and why, for the Gaps section. */
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules a plan carries on top of the core (spec §6.1). A route needs at least two cities to be
 * an order, and a single has no support slot. Budget split is always offered: shares with no
 * budget, amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  const ruledOut: ModulePick['ruledOut'] = [];
  const allowed: LaunchModuleKey[] = MUSIC_MODULES.filter((key) => {
    const why = ruleOut(key, input);
    if (why) ruledOut.push({ key, why });
    return why === null;
  });
  if (input.scope === 'full') return { modules: allowed, ruledOut };
  return {
    modules: input.ask && allowed.includes(input.ask) ? [input.ask] : [],
    ruledOut: ruledOut.filter((r) => r.key === input.ask),
  };
}

function ruleOut(key: LaunchModuleKey, input: ModuleInput): string | null {
  switch (key) {
    case 'tour':
      return input.cities >= 2 ? null : 'A tour route needs at least two cities.';
    case 'support':
      return input.releaseType === 'single' ? 'A single release has no support slot.' : null;
    default:
      return null;
  }
}

/**
 * Shares for a Budget split, labelled a starting split in the plan. Amounts are computed by code.
 * Chosen conventions, not measured.
 */
export const BUDGET_CONVENTION: { line: string; share: number }[] = [
  { line: 'Paid media and playlist placement', share: 0.35 },
  { line: 'Publicity, press and radio', share: 0.15 },
  { line: 'Live dates and tour support', share: 0.2 },
  { line: 'Creative (video, artwork, content)', share: 0.15 },
  { line: 'Partnerships and sync pitching', share: 0.05 },
  { line: 'Contingency', share: 0.1 },
];
