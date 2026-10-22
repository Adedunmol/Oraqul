import { BASELINE_BRANDS, BASELINE_PODCASTS } from '../launch';
import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const film: CategoryPack = {
  category: 'film',
  title: 'Film and series',
  blurb: 'Release plans for films and series, by territory and opening date.',
  covers: 'feature films, short films, documentaries, TV and streaming series, miniseries',
  systemPrompt:
    'You are the film and series agent. Read the lead title as a film or a series, and ask the user to pick when a name matches both.',
  assumptionChecklist: [
    "The lead title's audience skews the way the plan assumes",
    'The title is findable in Qloo as one work, not several',
  ],
  planSections: [
    { key: 's1', title: 'Trailer pairings', one: 'Trailer pairing' },
    { key: 's2', title: 'Partner brands', one: 'Partner brand' },
    { key: 's3', title: 'Press and podcasts', one: 'Press or podcast' },
    { key: 's4', title: 'Cities', one: 'City' },
  ],
  toolAllowlist: [
    'searchEntity',
    'audienceBySegment',
    'resolveBundle',
    'rankPlaces',
    'lift',
    'partnerFit',
    'scoreRivals',
    'filmProfiles',
    'topicMap',
  ],
  consults: [],
  qloo: { titles: ['urn:entity:movie', 'urn:entity:tv_show'], ...sharedQlooCoverage },
  // TODO(verify): that each name resolves to one exact match on the live host. One that does not
  // is left out of the baseline for that run.
  baselines: {
    'urn:entity:movie': [
      'Avengers: Endgame',
      'Top Gun: Maverick',
      'Avatar: The Way of Water',
      'Spider-Man: No Way Home',
    ],
    'urn:entity:brand': BASELINE_BRANDS,
    'urn:entity:podcast': BASELINE_PODCASTS,
  },
  coverage: { tests: [], thin: [], notSupported: [] },
};
