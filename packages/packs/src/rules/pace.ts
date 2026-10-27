import type { Category, CurvePoint } from '@oraqul/schema';
import { teamRule } from './shared';
import type { Rule } from './types';

// How the team's own figures are read against the plan's one signal (launch rules D2, D5). The
// curves are editable conventions, not facts and not forecasts: Oraqul says whether the figures
// are ahead of, on or behind a convention, and never projects where they will end up.

export const PACE_VERSION = 'pace@2026-10-27.1';

export interface PaceRule {
  /** A cumulative signal adds up toward a target by release; a level signal is read at its checkpoints. */
  kind: 'cumulative' | 'level';
  /** Whether people usually enter what was counted each day or a running total. */
  entry: 'daily' | 'running-total';
  /**
   * Expected share of the target by each day from release (negative is before). Empty for a level
   * signal, which is compared with the target at and after its first checkpoint.
   */
  curve: CurvePoint[];
  /** Where the default comes from, said plainly beside the verdict. */
  basis: string;
}

export const PACE_THRESHOLDS = {
  /** Actual over expected at or above this is ahead. */
  aheadAt: 1.1,
  /** Actual over expected below this is behind. */
  behindBelow: 0.9,
  /** Fewer dated entries than this is too early to tell. */
  minEntries: 3,
  /** Expected share of the target below this is too early to tell: a ratio of tiny numbers says nothing. */
  minExpectedShare: 0.1,
};

const BACK_LOADED =
  'A back loaded convention for ticket style launches: most sales come in the last weeks. It is a default the team can edit, not a measured curve.';

export const PACE_RULES: Record<Category, Rule<PaceRule>> = {
  film: teamRule('pace.film', {
    kind: 'cumulative',
    entry: 'daily',
    curve: [
      { day: -84, share: 0 },
      { day: -56, share: 0.1 },
      { day: -28, share: 0.3 },
      { day: -7, share: 0.65 },
      { day: 0, share: 1 },
    ],
    basis: BACK_LOADED,
  }),
  shows: teamRule('pace.shows', {
    kind: 'cumulative',
    entry: 'daily',
    curve: [
      { day: -56, share: 0 },
      { day: -49, share: 0.06 },
      { day: -7, share: 0.43 },
      { day: 0, share: 1 },
    ],
    basis:
      'The last week holds about 57 percent of sales across events and the first week on sale about 6 percent for comedy (live shows rule E2, secondhand sources). The points between are straight lines: a default the team can edit.',
  }),
  games: teamRule('pace.games', {
    kind: 'cumulative',
    entry: 'running-total',
    curve: [
      { day: -365, share: 0 },
      { day: -120, share: 0.85 },
      { day: 0, share: 1 },
    ],
    basis:
      'About 85 percent of wishlists should be collected at least four months before release (launch rule D1). The earlier points are a straight line: a default the team can edit.',
  }),
  music: teamRule('pace.music', {
    kind: 'level',
    entry: 'running-total',
    curve: [],
    basis:
      'A rate read at the plan’s checkpoints and compared with the target. There is no sourced curve for it.',
  }),
  podcasts: teamRule('pace.podcasts', {
    kind: 'level',
    entry: 'running-total',
    curve: [],
    basis:
      'Downloads per episode read at the plan’s checkpoints and compared with the target. There is no sourced curve for it.',
  }),
  books: teamRule('pace.books', {
    kind: 'level',
    entry: 'running-total',
    curve: [],
    basis:
      'Advance copy conversion read at the plan’s checkpoints and compared with the target. There is no sourced curve for it.',
  }),
};
