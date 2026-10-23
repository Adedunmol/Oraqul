import { teamRule } from './shared';
import type { RuleLibrary } from './types';

// The calendar itself is the kind profiles' (`books/modules.ts`); this records the rules it rests on.
export const BOOKS_RULES: RuleLibrary = {
  category: 'books',
  version: 'books@2026-10-22.1',
  timeline: [
    teamRule(
      'books.timeline',
      'Send advance copies 2 to 3 months before publication (12 to 8 weeks out), so early reviews can land before the launch week.',
    ),
  ],
  beats: [],
  signal: teamRule('books.signal', {
    key: 'advance-conversion-reviews',
    primary: 'Advance copy conversion and early reviews',
    secondary: ['Followers', 'Views', 'Pre-orders'],
    checkpoints: [-28, 0, 28],
    benchmark: null,
  }),
  channels: teamRule('books.channels', ['TikTok', 'Instagram Reels', 'YouTube Shorts']),
};
