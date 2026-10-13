import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const books: CategoryPack = {
  category: 'books',
  title: 'Books',
  systemPrompt: '',
  assumptionChecklist: [],
  planSections: [],
  toolAllowlist: [],
  qloo: { titles: ['urn:entity:book'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
