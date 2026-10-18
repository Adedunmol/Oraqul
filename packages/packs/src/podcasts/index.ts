import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const podcasts: CategoryPack = {
  category: 'podcasts',
  title: 'Podcasts',
  blurb: 'Shows, guests and sponsors, planned around the listener.',
  covers: 'podcast shows, seasons, episodes, guests and sponsorships',
  systemPrompt: 'You are the podcasts agent.',
  assumptionChecklist: ["The show's audience skews the way the plan assumes"],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: [],
  qloo: { titles: ['urn:entity:podcast'], ...sharedQlooCoverage },
  baselines: {},
  coverage: { tests: [], thin: [], notSupported: [] },
};
