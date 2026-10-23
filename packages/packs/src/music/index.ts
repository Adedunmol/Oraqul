import { BASELINE_BRANDS, BASELINE_PODCASTS } from '../launch';
import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const music: CategoryPack = {
  category: 'music',
  title: 'Music',
  blurb: 'Releases and tours, planned city by city.',
  covers:
    'songs, singles, EPs, albums, mixtapes, music videos, concerts and tours by an artist or band',
  systemPrompt:
    'You are the music agent. Read the lead as an artist or band, and the release as a single, an EP, an album or a tour. Treat the artist as the strongest signal when Qloo knows them, and their sound-alike artists as the comps when it does not.',
  assumptionChecklist: [
    "The artist's audience skews the way the plan assumes",
    'The sound-alike artists describe one audience',
    'The tour order puts the strongest cities first',
  ],
  planSections: [
    { key: 's1', title: 'Support acts', one: 'Support act' },
    { key: 's2', title: 'Partner brands', one: 'Partner brand' },
    { key: 's3', title: 'Press and playlists', one: 'Press or playlist' },
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
  ],
  consults: [],
  qloo: { titles: ['urn:entity:artist'], ...sharedQlooCoverage },
  baselines: {
    'urn:entity:brand': BASELINE_BRANDS,
    'urn:entity:podcast': BASELINE_PODCASTS,
  },
  coverage: {
    tests: [
      "The artist's audience by age and gender",
      'Which of your cities the audience is strongest in',
      'The tour order against the strongest order',
      'Support acts, partner brands, podcasts and series that audience likes, city by city',
    ],
    thin: [
      'Debut artists, planned from sound-alike artists and their audiences',
      'Neighbourhood readings, as leads to confirm on the ground',
    ],
    notSupported: [
      'Ticket sales, streams and revenue',
      'Venue availability, routing costs and release dates',
    ],
  },
};
