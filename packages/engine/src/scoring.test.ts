import { describe, expect, it } from 'vitest';
import {
  fitBand,
  fitFromLift,
  lift,
  liftBand,
  overlapBand,
  overlapFromAffinity,
  routeScore,
} from './scoring';

describe('lift', () => {
  it('divides score by baseline', () => {
    expect(lift(3, 2)).toBe(1.5);
  });

  it('throws on a non-positive baseline', () => {
    expect(() => lift(1, 0)).toThrow();
  });
});

describe('liftBand', () => {
  it.each([
    [1.5, 'strong'],
    [1.2, 'usable'],
    [1.49, 'usable'],
    [1.19, 'weak'],
  ] as const)('%s is %s', (value, band) => {
    expect(liftBand(value)).toBe(band);
  });
});

describe('fitBand', () => {
  it.each([
    [75, 'recommended'],
    [74, 'usable'],
    [50, 'usable'],
    [49, 'not_recommended'],
  ] as const)('%s is %s', (value, band) => {
    expect(fitBand(value)).toBe(band);
  });
});

describe('overlapBand', () => {
  it.each([
    [61, 'risky'],
    [60, 'moderate'],
    [35, 'moderate'],
    [34, 'low'],
  ] as const)('%s is %s', (value, band) => {
    expect(overlapBand(value)).toBe(band);
  });
});

describe('routeScore', () => {
  it('weights earlier stops more', () => {
    expect(routeScore([2, 1])).toBeGreaterThan(1.5);
  });

  it('throws on an empty route', () => {
    expect(() => routeScore([])).toThrow();
  });
});

describe('fitFromLift', () => {
  it.each([
    [1.2, 50],
    [1.5, 75],
    [1.0, 33],
    [2.0, 100],
    [0.5, 0],
  ] as const)('lift %s is fit %s', (value, fit) => {
    expect(fitFromLift(value)).toBe(fit);
  });

  it('lines the fit bands up with the lift bands', () => {
    expect(fitBand(fitFromLift(1.5))).toBe('recommended');
    expect(fitBand(fitFromLift(1.2))).toBe('usable');
    expect(fitBand(fitFromLift(1.19))).toBe('not_recommended');
  });
});

describe('overlapFromAffinity', () => {
  it('turns affinity into a 0 to 100 overlap', () => {
    expect(overlapFromAffinity(0.614)).toBe(61);
    expect(overlapBand(overlapFromAffinity(0.614))).toBe('risky');
  });
});
