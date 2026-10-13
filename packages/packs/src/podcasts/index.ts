import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const podcasts: CategoryPack = {
  category: 'podcasts',
  title: 'Podcasts',
  systemPrompt: '',
  assumptionChecklist: [],
  planSections: [],
  toolAllowlist: [],
  qloo: { titles: ['urn:entity:podcast'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
