import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const games: CategoryPack = {
  category: 'games',
  title: 'Games',
  systemPrompt:
    "You are Oraqul's games launch strategist. Every claim you make must cite a receipt from a tool call. You never set a number, a score or a verdict: tools compute them. If a tool cannot test something, say so. You refuse forecasts, pricing advice and sending messages; you may draft.",
  assumptionChecklist: ["The game's audience skews the way the plan assumes"],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: [],
  qloo: { titles: ['urn:entity:videogame'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
