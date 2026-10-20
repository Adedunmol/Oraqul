import type { Verdict } from '@oraqul/schema';

// The rules and their thresholds are docs/product/spec.md section 5.2. Change them there first.

export interface VerdictResult {
  verdict: Verdict;
  /** How the verdict was reached, in words a marketer can read. Published on the line. */
  why: string;
}

const AGE_NEAR_TOP = 0.05;
const GENDER_LEAN = 0.05;

/** Spec §5.2: an age or gender affinity as a 0 to 100 index, 50 neutral. Never a share. */
export function audienceIndex(affinity: number): number {
  return Math.min(100, Math.max(0, Math.round(50 + 50 * affinity)));
}

/** Averages each band over the rows Qloo returned, one row per comp that has a profile. */
export function averageBands(rows: Record<string, number>[]): Record<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const row of rows) {
    for (const [band, value] of Object.entries(row)) {
      const s = sums.get(band) ?? { total: 0, n: 0 };
      sums.set(band, { total: s.total + value, n: s.n + 1 });
    }
  }
  return Object.fromEntries([...sums].map(([band, s]) => [band, s.total / s.n]));
}

export function ageVerdict(band: string, ages: Record<string, number>): VerdictResult {
  const entries = Object.entries(ages);
  const value = ages[band];
  if (entries.length === 0 || value === undefined) {
    return { verdict: 'cant', why: 'Qloo returned no age profile for these comps.' };
  }
  const top = Math.max(...entries.map(([, v]) => v));
  const shown = `affinity ${value.toFixed(2)}, top band ${top.toFixed(2)}`;
  if (top - value <= AGE_NEAR_TOP) {
    return { verdict: 'holds', why: `It is the top age band, or close to it (${shown}).` };
  }
  if (value > 0) {
    return { verdict: 'weak', why: `The band leans in, but other bands lean in more (${shown}).` };
  }
  return { verdict: 'breaks', why: `The comps' audience leans away from this band (${shown}).` };
}

export function genderVerdict(
  gender: 'male' | 'female',
  genders: Record<string, number>,
): VerdictResult {
  const value = genders[gender];
  if (value === undefined) {
    return { verdict: 'cant', why: 'Qloo returned no gender profile for these comps.' };
  }
  const shown = `affinity ${value.toFixed(2)}`;
  if (value > GENDER_LEAN)
    return { verdict: 'holds', why: `The audience leans this way (${shown}).` };
  if (value >= -GENDER_LEAN)
    return { verdict: 'weak', why: `The audience is close to even (${shown}).` };
  return { verdict: 'breaks', why: `The audience leans the other way (${shown}).` };
}

export function placeVerdict(place: {
  status: 'ranked' | 'not_ranked' | 'unknown_place';
  lift: number | null;
  cells: number;
}): VerdictResult {
  if (place.status === 'unknown_place') {
    return { verdict: 'cant', why: 'This city is not in the city table, so it was not tested.' };
  }
  if (place.status === 'not_ranked' || place.lift === null) {
    return {
      verdict: 'cant',
      why: `Only ${place.cells} cells came back, too few to rank the city.`,
    };
  }
  const shown = `lift ${place.lift.toFixed(2)} over an average city in the same call`;
  if (place.lift >= 1.2)
    return { verdict: 'holds', why: `The audience concentrates here (${shown}).` };
  if (place.lift >= 1)
    return { verdict: 'weak', why: `About average for this audience (${shown}).` };
  return { verdict: 'breaks', why: `The audience is thinner here than elsewhere (${shown}).` };
}

// Spec §5.4. How close the team's tour order scores to the best order. Starting values,
// TODO(verify) on a live run before a plan leads with them.
const ROUTE_HOLDS = 0.95;
const ROUTE_WEAK = 0.85;

/** Spec §5.4: the team's route score as a share of the best order's. */
export function routeVerdict(actual: number, best: number): VerdictResult {
  if (best <= 0) {
    return { verdict: 'cant', why: 'The route could not be scored: no stop had a positive lift.' };
  }
  const ratio = actual / best;
  const shown = `route score ${actual.toFixed(2)} against ${best.toFixed(2)} for the strongest order`;
  if (ratio >= ROUTE_HOLDS) {
    return {
      verdict: 'holds',
      why: `The tour order is at or near the strongest order (${shown}).`,
    };
  }
  if (ratio >= ROUTE_WEAK) {
    return { verdict: 'weak', why: `A different order would start stronger (${shown}).` };
  }
  return { verdict: 'breaks', why: `The strongest cities come late in this order (${shown}).` };
}

export function compsVerdict(
  check:
    | { result: 'holds' }
    | { result: 'changes'; restsOn: string }
    | { result: 'skipped' }
    | null,
): VerdictResult {
  if (check === null) {
    return { verdict: 'cant', why: 'Needs at least 3 comps that Qloo found to check.' };
  }
  switch (check.result) {
    case 'holds':
      return { verdict: 'holds', why: 'The city order held with each comp left out.' };
    case 'changes':
      return { verdict: 'weak', why: `The city order rests on ${check.restsOn}.` };
    case 'skipped':
      return { verdict: 'cant', why: 'The call budget did not cover the check.' };
  }
}

// Spec §5.6: how many of a game's comps list a platform, from what Qloo holds on each comp. A
// share needs at least this many comps with platform data behind it. Starting values,
// TODO(verify) on a live run before a plan leads with them.
const MIN_COMPS_WITH_DATA = 2;
const PLATFORM_HOLDS = 2 / 3;
const PLATFORM_WEAK = 1 / 3;

export interface PlatformShare {
  platform: string;
  /** Comps that list the platform. */
  listing: number;
  /** Comps Qloo holds platform data for. */
  withData: number;
}

/** Spec §5.6: the platforms the team named against where its comparable games live. */
export function platformVerdict(shares: PlatformShare[]): VerdictResult {
  const tested = shares.filter((s) => s.withData >= MIN_COMPS_WITH_DATA);
  if (tested.length === 0) {
    return {
      verdict: 'cant',
      why: 'Qloo holds platform data for fewer than two of the comparable games.',
    };
  }
  const rows = tested.map((s) => ({ ...s, share: s.listing / s.withData }));
  const lowest = rows.reduce((a, b) => (b.share < a.share ? b : a));
  const shown = `${lowest.listing} of ${lowest.withData} comparable games list ${lowest.platform}`;
  if (lowest.share >= PLATFORM_HOLDS) {
    return {
      verdict: 'holds',
      why: `Every platform you named is where the comps live (${shown}).`,
    };
  }
  if (lowest.share >= PLATFORM_WEAK) {
    return { verdict: 'weak', why: `Some comparable games skip a platform you named (${shown}).` };
  }
  return { verdict: 'breaks', why: `Few comparable games are on a platform you named (${shown}).` };
}

/**
 * Spec §5.6: store tags the team named against the tags at least half of its comps share. Wording
 * is not audience, so a miss is weak and never breaks.
 */
export function storeTagVerdict(matched: number, shared: number, withData: number): VerdictResult {
  if (withData < MIN_COMPS_WITH_DATA) {
    return { verdict: 'cant', why: 'Qloo holds tags for fewer than two of the comparable games.' };
  }
  if (shared === 0) {
    return {
      verdict: 'cant',
      why: 'The comparable games share no tag, so there is nothing to match.',
    };
  }
  const shown = `${matched} of your tags match the ${shared} tags at least half of the comps share`;
  if (matched >= 2) return { verdict: 'holds', why: `Your store tags fit the comps (${shown}).` };
  return { verdict: 'weak', why: `Your store tags barely overlap with the comps (${shown}).` };
}
