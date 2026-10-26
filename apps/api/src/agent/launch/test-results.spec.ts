import type { TestResults } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { CLOSE_SHARE, compareTest, MIN_FIGURE } from './test-results.js';

const results = (a: number, b: number): TestResults => ({
  measure: 'conversions',
  a,
  b,
  period: null,
  source: null,
});

describe('compareTest', () => {
  it('says inconclusive when either angle has too few', () => {
    const out = compareTest(results(MIN_FIGURE - 1, 400));
    expect(out.verdict).toBe('inconclusive');
    expect(out.why).toMatch(/too few/);
  });

  it('says inconclusive when the figures are close', () => {
    const out = compareTest(results(100, 100 * (1 - CLOSE_SHARE) + 1));
    expect(out.verdict).toBe('inconclusive');
    expect(out.why).toMatch(/too close to call/);
  });

  it('names the angle that recorded more and gives the gap, not a reason', () => {
    expect(compareTest(results(120, 80))).toMatchObject({ verdict: 'a-ahead' });
    const b = compareTest(results(80, 120));
    expect(b.verdict).toBe('b-ahead');
    expect(b.why).toMatch(/50% more/);
    expect(b.why).toMatch(/hypothesis/);
  });

  it('treats two equal figures as inconclusive', () => {
    expect(compareTest(results(90, 90)).verdict).toBe('inconclusive');
  });
});
