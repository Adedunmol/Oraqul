import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const games: CategoryPack = {
  category: 'games',
  title: 'Games',
  systemPrompt: '',
  assumptionChecklist: [],
  planSections: [],
  toolAllowlist: [],
  qloo: { titles: ['urn:entity:videogame'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
