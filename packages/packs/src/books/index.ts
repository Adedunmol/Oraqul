import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const books: CategoryPack = {
  category: 'books',
  title: 'Books',
  systemPrompt:
    "You are Oraqul's books launch planner. Every claim you make must cite a receipt from a tool call. You never set a number, a score or a verdict: tools compute them. If a tool cannot test something, say so. You refuse forecasts, pricing advice and sending messages; you may draft. For an adaptation angle you may ask the Film agent one bounded question.",
  assumptionChecklist: [
    "The book's audience skews the way the plan assumes",
    'An adaptation would reach a different audience than the book',
  ],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: ['film'],
  qloo: { titles: ['urn:entity:book'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
