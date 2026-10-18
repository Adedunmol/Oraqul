import type { FitBand } from '@oraqul/schema';

// Thresholds are from docs/product/spec.md section 5. Change them there first.

export type LiftBand = 'strong' | 'usable' | 'weak';
export type OverlapBand = 'risky' | 'moderate' | 'low';

export function lift(score: number, baselineScore: number): number {
  if (baselineScore <= 0) {
    throw new Error('Baseline score must be positive to compute lift');
  }
  return score / baselineScore;
}

export function liftBand(value: number): LiftBand {
  if (value >= 1.5) return 'strong';
  if (value >= 1.2) return 'usable';
  return 'weak';
}

export function fitBand(fit: number): FitBand {
  if (fit >= 75) return 'recommended';
  if (fit >= 50) return 'usable';
  return 'not_recommended';
}

export function overlapBand(overlap: number): OverlapBand {
  if (overlap > 60) return 'risky';
  if (overlap >= 35) return 'moderate';
  return 'low';
}

/** Weighted mean of lift over tour stops, weights 1, 0.9, 0.8, 0.7, ... by position. */
export function routeScore(lifts: number[]): number {
  if (lifts.length === 0) {
    throw new Error('Route needs at least one stop');
  }
  let weighted = 0;
  let total = 0;
  lifts.forEach((value, index) => {
    const weight = Math.max(1 - index * 0.1, 0.1);
    weighted += value * weight;
    total += weight;
  });
  return weighted / total;
}

export interface RouteStop {
  place: string;
  lift: number;
}

/**
 * The same stops with the strongest first, and the route score of that order (spec §5.4), to set
 * beside the team's own order. Ties keep the team's order.
 */
export function bestRoute(stops: RouteStop[]): { order: string[]; score: number } {
  const ordered = [...stops].sort((a, b) => b.lift - a.lift);
  return { order: ordered.map((s) => s.place), score: routeScore(ordered.map((s) => s.lift)) };
}

/** Band edges and how close to one a value is near it (spec §5.1, margin). */
export const bandEdges = {
  lift: { edges: [1.2, 1.5], within: 0.05 },
  fit: { edges: [50, 75], within: 3 },
  overlap: { edges: [35, 60], within: 3 },
} as const;

export function isNearEdge(kind: keyof typeof bandEdges, value: number): boolean {
  const { edges, within } = bandEdges[kind];
  // 1.25 - 1.2 is 0.050000000000000044 in floating point, which must still count as within.
  return edges.some((edge) => Math.abs(value - edge) <= within + 1e-9);
}

/** Spec §5: lift on a 0 to 100 scale, so lift 1.2 is fit 50 and lift 1.5 is fit 75. */
export function fitFromLift(liftValue: number): number {
  return Math.min(100, Math.max(0, Math.round(50 + ((liftValue - 1.2) * 250) / 3)));
}

/** Spec §5: a rival's affinity to our audience, 0 to 1, as a 0 to 100 overlap. */
export function overlapFromAffinity(affinity: number): number {
  return Math.min(100, Math.max(0, Math.round(affinity * 100)));
}
