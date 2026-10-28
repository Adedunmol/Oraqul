import { teamRule } from './shared';

// What a launch watch looks for. Dates for rivals come from the web, each with its page and the day
// it was read; nothing here asks Qloo. The numbers are conventions the team can change.

export const WATCH_VERSION = 'watch@2026-10-27.1';

export const WATCH_RULES = {
  /** A plan this many days old is offered a check of what has changed (spec §5.16). */
  staleDays: teamRule('watch.stale-days', 14),
  /** A rival opening this close to the release date is a watch event. */
  rivalWindowDays: teamRule('watch.rival-window-days', 7),
  /** A rival opening this close, the same weekend, is an act event. */
  rivalSameWeekendDays: teamRule('watch.rival-same-weekend-days', 2),
  /** An undone milestone this many days late is an act event. */
  milestoneActAfterDays: teamRule('watch.milestone-act-after-days', 3),
  /** A fund deadline this close, for a fund still being worked, is a watch event. */
  deadlineSoonDays: teamRule('watch.deadline-soon-days', 14),
  /** How far either side of the release date a search looks for rivals. */
  rivalSearchDays: teamRule('watch.rival-search-days', 28),
};
