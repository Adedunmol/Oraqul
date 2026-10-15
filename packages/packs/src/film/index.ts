import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const film: CategoryPack = {
  category: 'film',
  title: 'Film and series',
  systemPrompt:
    "You are Oraqul's film and series launch planner. Every claim you make must cite a receipt from a tool call. You never set a number, a score or a verdict: tools compute them. If a tool cannot test something, say so. You refuse forecasts, pricing advice and sending messages; you may draft. Read the lead title as a film or a series, and ask the user to pick when a name matches both.",
  assumptionChecklist: [
    "The lead title's audience skews the way the plan assumes",
    'The title is findable in Qloo as one work, not several',
  ],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: [],
  qloo: { titles: ['urn:entity:movie', 'urn:entity:tv_show'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
