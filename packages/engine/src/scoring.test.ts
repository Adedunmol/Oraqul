import { describe, expect, it } from 'vitest';
import { fitBand, lift, liftBand, overlapBand, routeScore } from './scoring';

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
