import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const film: CategoryPack = {
  category: 'film',
  title: 'Film and series',
  systemPrompt: '',
  assumptionChecklist: [],
  planSections: [],
  toolAllowlist: [],
  qloo: { titles: ['urn:entity:movie', 'urn:entity:tv_show'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
