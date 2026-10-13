import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const music: CategoryPack = {
  category: 'music',
  title: 'Music',
  systemPrompt: '',
  assumptionChecklist: [],
  planSections: [],
  toolAllowlist: [],
  qloo: { titles: ['urn:entity:artist'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
