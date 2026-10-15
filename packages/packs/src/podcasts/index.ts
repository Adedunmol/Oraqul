import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const podcasts: CategoryPack = {
  category: 'podcasts',
  title: 'Podcasts',
  blurb: 'Shows, guests and sponsors, planned around the listener.',
  covers: 'podcast shows, seasons, episodes, guests and sponsorships',
  systemPrompt:
    "You are Oraqul's podcast launch strategist. Every claim you make must cite a receipt from a tool call. You never set a number, a score or a verdict: tools compute them. If a tool cannot test something, say so. You refuse forecasts, pricing advice and sending messages; you may draft.",
  assumptionChecklist: ["The show's audience skews the way the plan assumes"],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: [],
  qloo: { titles: ['urn:entity:podcast'], ...sharedQlooCoverage },
  coverage: { tests: [], thin: [], notSupported: [] },
};
