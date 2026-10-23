import { teamRule } from './shared';
import type { RuleLibrary } from './types';

// The calendar itself is the kind profiles' (`games/modules.ts`); this records the rules it rests on.
export const GAMES_RULES: RuleLibrary = {
  category: 'games',
  version: 'games@2026-10-22.1',
  timeline: [
    teamRule(
      'games.timeline',
      'About 85 percent of wishlists are collected at least four months before release, so the store page and the wishlist drive start by 16 weeks out at the latest.',
    ),
  ],
  beats: [],
  signal: teamRule('games.signal', {
    key: 'wishlists',
    primary: 'Wishlists',
    secondary: ['Followers', 'Views', 'Demo plays'],
    checkpoints: [-112, -56, -14],
    benchmark: { value: 7000, floor: 5000, unit: 'wishlists' },
  }),
  channels: teamRule('games.channels', ['YouTube', 'TikTok', 'Discord']),
};
