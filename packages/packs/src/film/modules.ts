import { type LaunchModuleKey, launchModuleKeys } from '@oraqul/schema';

/** Section titles, as the Plan tab and the exports show them. */
export const SECTION_TITLES = {
  'bottom-line': 'Bottom line',
  positioning: 'Positioning',
  audience: 'Audience',
  markets: 'Markets',
  gaps: 'To sharpen this plan',
  partnerships: 'Partnerships',
  placement: 'Creative placement',
  publicity: 'Publicity and media',
  community: 'Community and grassroots',
  route: 'Release route and window',
  timeline: 'Timeline',
  cadence: 'Release cadence',
  budget: 'Budget split',
  measure: 'What to measure',
  risks: 'Risks',
} as const;

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
 * Which modules a plan carries on top of the core (spec §6.1). A full plan gets every module the
 * brief does not rule out; a narrow ask gets only the module it names. Only a format that does
 * not fit rules a module out. Budget split is always offered: as percentages with no budget, as
 * amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  const ruledOut: ModulePick['ruledOut'] = [];
  const allowed = launchModuleKeys.filter((key) => {
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
 * The fixed convention a Budget split uses, as shares of the total. Labelled as a starting split
 * in the plan; the amounts are computed by code, never set by the model.
 * TODO(verify): with a distribution partner. These are a starting split, not a benchmark.
 */
export const BUDGET_CONVENTION: { line: string; share: number }[] = [
  { line: 'Paid media and trailer placement', share: 0.4 },
  { line: 'Publicity and press', share: 0.15 },
  { line: 'Community screenings and events', share: 0.15 },
  { line: 'Creative (trailer, key art, cut-downs)', share: 0.15 },
  { line: 'Partnerships and tie-ins', share: 0.05 },
  { line: 'Contingency', share: 0.1 },
];

/**
 * Words that claim what an audience likes. A playbook line may not use them: taste claims must
 * cite a finding (spec §6.2).
 */
export const TASTE_CLAIM =
  /\b(fans?|fandoms?|loves?|loved|likes?|liked|prefers?|preferred|resonat\w*|affinit\w*|skews?|skewed|over-?index\w*|popular (?:with|among)|tastes?|enjoys?|enjoyed|devoted)\b/i;
