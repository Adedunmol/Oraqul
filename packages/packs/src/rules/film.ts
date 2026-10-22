import type { Beat } from '../launch';
import { teamRule } from './shared';
import type { RuleLibrary } from './types';

// A film plan runs months, not weeks. Weeks are counted from the release date (negative is before).
const beats: Beat[] = [
  {
    at: -26,
    until: -16,
    key: 'key-art',
    text: 'Lock the title treatment and key art, cut the first teaser and set up the sales and presale page.',
  },
  {
    at: -20,
    until: -12,
    key: 'festival',
    text: 'Use a festival or market slot to build early press and distributor interest, never as the only beat.',
  },
  {
    at: -12,
    key: 'trailer-one',
    text: 'Release the first trailer on the lead video platform and open advance screening sign-ups.',
  },
  {
    at: -10,
    until: -6,
    key: 'community-screenings',
    text: 'Book advance screenings with community groups, cinemas and creators in each territory.',
  },
  {
    at: -8,
    key: 'presales',
    text: 'Open presales where the cinema or platform allows it and read the first week against the target.',
  },
  {
    at: -4,
    until: -3,
    key: 'press-wave',
    text: 'Send the press screener and the second trailer, and confirm premiere guests.',
  },
  {
    at: -1,
    key: 'premiere',
    text: 'Hold the home-market premiere, with the other territories following within days.',
  },
  {
    at: 0,
    key: 'release',
    text: 'Release and report advance screenings and presales to the team daily.',
  },
  {
    at: 1,
    until: 4,
    key: 'second-wave',
    text: 'Move spend to the territories where presales and screenings are ahead, and plan the streaming or home release window.',
  },
];

export const FILM_RULES: RuleLibrary = {
  category: 'film',
  version: 'film@2026-10-22.1',
  timeline: [
    teamRule(
      'film.timeline',
      'Work back from the release date: key art and sales page about 26 weeks out, first trailer 12 weeks out, advance screenings 10 to 6 weeks out, presales 8 weeks out.',
    ),
  ],
  beats,
  signal: teamRule('film.signal', {
    key: 'screenings-presales',
    primary: 'Advance screenings and presales',
    secondary: ['Trailer views', 'Followers', 'Press mentions'],
    checkpoints: [-56, -28, -7],
    benchmark: null,
  }),
  channels: teamRule('film.channels', ['YouTube', 'Instagram', 'TikTok']),
};
