import { teamRule } from './shared';
import type { RuleLibrary } from './types';

// The calendar itself is the kind profiles' (`podcasts/modules.ts`); this records the rules it rests on.
export const PODCASTS_RULES: RuleLibrary = {
  category: 'podcasts',
  version: 'podcasts@2026-10-22.1',
  timeline: [
    teamRule(
      'podcasts.timeline',
      'Treat days 1 to 60 after release as the campaign: the launch window in week 1, the chart window after it, and the read at day 30 and day 60.',
    ),
  ],
  beats: [],
  signal: teamRule('podcasts.signal', {
    key: 'downloads-per-episode',
    primary: 'Downloads per episode at day 30 and day 60',
    secondary: ['Followers', 'Views', 'Ratings'],
    checkpoints: [30, 60],
    benchmark: null,
  }),
  channels: teamRule('podcasts.channels', ['YouTube', 'Instagram', 'TikTok']),
};
