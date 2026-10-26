import type { TestComparison, TestResults } from '@oraqul/schema';

// Comparing the two angles of a campaign test, in code, from the team's own figures. The numbers are
// chosen conventions, not a significance test: Oraqul has no impressions or audience size, only the
// counts the team gives. Change them here and in docs/product/spec.md §5.15 together.

/** Fewer than this many of the measure for either angle is too few to tell them apart. */
export const MIN_FIGURE = 30;
/** Figures within this share of the larger are too close to call. */
export const CLOSE_SHARE = 0.2;

export function compareTest(results: TestResults): TestComparison {
  const { a, b, measure } = results;
  if (a < MIN_FIGURE || b < MIN_FIGURE) {
    return {
      verdict: 'inconclusive',
      why: `Fewer than ${MIN_FIGURE} ${measure} for at least one angle (${a} and ${b}), too few to tell them apart. Collect more before you decide.`,
    };
  }
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if ((high - low) / high < CLOSE_SHARE) {
    return {
      verdict: 'inconclusive',
      why: `The two are within ${Math.round(CLOSE_SHARE * 100)}% of each other (${a} and ${b} ${measure}), too close to call.`,
    };
  }
  const ahead = a > b ? 'a' : 'b';
  return {
    verdict: `${ahead}-ahead`,
    why: `Angle ${ahead.toUpperCase()} recorded ${high} ${measure} against ${low}, ${Math.round(((high - low) / low) * 100)}% more. That is a difference in your figures, not a reason: why it happened is a hypothesis to test.`,
  };
}
