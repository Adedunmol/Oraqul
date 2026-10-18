import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const music: CategoryPack = {
  category: 'music',
  title: 'Music',
  blurb: 'Releases and tours, planned city by city.',
  covers:
    'songs, singles, EPs, albums, mixtapes, music videos, concerts and tours by an artist or band',
  systemPrompt: 'You are the music agent.',
  assumptionChecklist: ["The artist's audience skews the way the plan assumes"],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: [],
  qloo: { titles: ['urn:entity:artist'], ...sharedQlooCoverage },
  baselines: {},
  coverage: { tests: [], thin: [], notSupported: [] },
};
