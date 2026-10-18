import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const games: CategoryPack = {
  category: 'games',
  title: 'Games',
  blurb: 'Fan bases, regions and collabs, planned before launch.',
  covers: 'video games, mobile games, console and PC games, DLC and expansions',
  systemPrompt: 'You are the games agent.',
  assumptionChecklist: ["The game's audience skews the way the plan assumes"],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: [],
  qloo: { titles: ['urn:entity:videogame'], ...sharedQlooCoverage },
  baselines: {},
  coverage: { tests: [], thin: [], notSupported: [] },
};
