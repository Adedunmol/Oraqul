import type { LaunchModuleKey } from '@oraqul/schema';

export { SECTION_TITLES, TASTE_CLAIM } from '../launch';

/**
 * The modules a Film plan can carry, in order. Frozen here so the modules other categories add to
 * the schema never reach a Film plan or the Film reader's prompt.
 */
export const FILM_MODULES = [
  'partnerships',
  'placement',
  'publicity',
  'community',
  'route',
  'timeline',
  'cadence',
  'budget',
  'measure',
  'risks',
] as const satisfies readonly LaunchModuleKey[];

export type ReleaseRoute = 'theatrical' | 'streaming' | 'festival' | 'hybrid';

export interface ModuleInput {
  scope: 'full' | 'narrow';
  /** The module a narrow ask names. Null when it names only core sections, such as cities. */
  ask: LaunchModuleKey | null;
  format: 'film' | 'series' | null;
  route: ReleaseRoute | null;
  hasBudget: boolean;
}

export interface ModulePick {
  modules: LaunchModuleKey[];
  /** Modules the brief rules out, and why, for the Gaps section. */
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules a plan carries on top of the core (spec §6.1). Only a format that does not fit rules one
 * out. Budget split is always offered: percentages with no budget, amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  const ruledOut: ModulePick['ruledOut'] = [];
  const allowed: LaunchModuleKey[] = FILM_MODULES.filter((key) => {
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
    case 'cadence':
      return input.format === 'series' ? null : 'Release cadence is for series only.';
    case 'placement':
      return input.route === 'streaming' && input.format !== 'series'
        ? 'A film going straight to streaming has no trailer run in cinemas.'
        : null;
    default:
      return null;
  }
}

/**
 * Shares for a Budget split, labelled a starting split in the plan. Amounts are computed by code.
 * Chosen conventions, not measured.
 */
export const BUDGET_CONVENTION: { line: string; share: number }[] = [
  { line: 'Paid media and trailer placement', share: 0.4 },
  { line: 'Publicity and press', share: 0.15 },
  { line: 'Community screenings and events', share: 0.15 },
  { line: 'Creative (trailer, key art, cut-downs)', share: 0.15 },
  { line: 'Partnerships and tie-ins', share: 0.05 },
  { line: 'Contingency', share: 0.1 },
];
