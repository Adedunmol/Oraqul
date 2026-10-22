import { BASELINE_BRANDS, BASELINE_PODCASTS } from '../launch';
import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const games: CategoryPack = {
  category: 'games',
  title: 'Games',
  blurb: 'Fan bases, regions and collabs, planned before launch.',
  covers:
    'video games, mobile games, console and PC games, early access releases, free-to-play and live-service games, DLC and expansions',
  systemPrompt:
    'You are the games agent. Read the lead as a game, and the launch as premium (PC or console), early access, free to play or live service, or mobile. Treat the game as the strongest signal when Qloo knows it, and its comparable games as the comps when it does not. The launch kind and platforms shape the calendar: say which you assumed when the brief does not say. Call the people who play the game players.',
  assumptionChecklist: [
    "The game's audience skews the way the plan assumes",
    'The comparable games describe one audience',
    'The platforms named are where the comparable games live',
    "The store tags fit the comparable games' tags",
  ],
  planSections: [
    { key: 's1', title: 'Fan base collabs', one: 'Fan base' },
    { key: 's2', title: 'Creators and streamers', one: 'Creator' },
    { key: 's3', title: 'Press and podcasts', one: 'Press or podcast' },
    { key: 's4', title: 'Regions', one: 'Region' },
  ],
  toolAllowlist: [
    'searchEntity',
    'audienceBySegment',
    'resolveBundle',
    'rankPlaces',
    'lift',
    'partnerFit',
    'scoreRivals',
    'findTaste',
    'themeTags',
    'gameProfiles',
  ],
  consults: [],
  qloo: { titles: ['urn:entity:videogame'], ...sharedQlooCoverage },
  baselines: {
    'urn:entity:brand': BASELINE_BRANDS,
    'urn:entity:podcast': BASELINE_PODCASTS,
  },
  coverage: {
    tests: [
      "The game's audience by age and gender",
      'Which of your regions the audience is strongest in',
      'Whether the platforms you named are where the comparable games are',
      'Whether your store tags match the tags your comparable games share',
      'Which music, series, anime, films, brands, podcasts and games that audience follows',
    ],
    thin: [
      'A debut game Qloo does not know yet, planned from comparable games',
      'Creators and streamers, which Qloo may not hold',
    ],
    notSupported: [
      'Wishlists, sales, player counts and review scores',
      'Festival, sale and showcase dates, which change every year',
    ],
  },
};
