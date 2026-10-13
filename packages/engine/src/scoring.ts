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
