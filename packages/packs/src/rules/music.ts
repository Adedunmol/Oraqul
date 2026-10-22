import type { Beat } from '../launch';
import { teamRule } from './shared';
import type { RuleLibrary } from './types';

// A music rollout runs 6 to 8 weeks. Weeks are counted from the release date.
const beats: Beat[] = [
  {
    at: -8,
    key: 'deliver',
    text: 'Deliver the release to the distributor with artwork and metadata, and pitch the playlists the platform allows.',
  },
  {
    at: -8,
    until: -6,
    key: 'teaser',
    text: 'Start short-video teasers: the hook, the lyric and the story behind the song, three to five a week.',
  },
  { at: -6, key: 'presave', text: 'Open the pre-save link and put it in every post.' },
  {
    at: -4,
    until: -3,
    key: 'press-wave',
    text: 'Send the song to press, radio and the playlist curators on the shortlist.',
  },
  {
    at: -2,
    key: 'video',
    text: 'Release the video or visualizer and the creator challenge or sound page.',
  },
  {
    at: 0,
    key: 'release',
    text: 'Release, and go live on the lead short-video platform the same day.',
  },
  {
    at: 1,
    until: 4,
    key: 'follow-through',
    text: 'Post a new angle every few days, answer comments, and move spend to the cities where saves and completion are ahead.',
  },
];

export const MUSIC_RULES: RuleLibrary = {
  category: 'music',
  version: 'music@2026-10-22.1',
  timeline: [
    teamRule(
      'music.timeline',
      'Work back from the release date over 6 to 8 weeks: delivery and playlist pitches 8 weeks out, pre-save 6 weeks out, press 4 weeks out, video 2 weeks out.',
    ),
  ],
  beats,
  signal: teamRule('music.signal', {
    key: 'save-rate-completion',
    primary: 'Save rate and stream completion',
    secondary: ['Followers', 'Views', 'Playlist adds'],
    checkpoints: [7, 28],
    benchmark: null,
  }),
  channels: teamRule('music.channels', ['TikTok', 'Instagram Reels', 'YouTube Shorts']),
};
