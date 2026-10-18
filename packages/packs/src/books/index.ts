import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const books: CategoryPack = {
  category: 'books',
  title: 'Books',
  blurb: 'Launch plans for titles and imprints, by market.',
  covers:
    'novels, non fiction, memoirs, poetry, comics and graphic novels, audiobooks, and imprints',
  systemPrompt:
    'You are the books agent. For an adaptation angle you may ask the Film agent one bounded question.',
  assumptionChecklist: [
    "The book's audience skews the way the plan assumes",
    'An adaptation would reach a different audience than the book',
  ],
  planSections: [],
  toolAllowlist: ['searchEntity', 'audienceBySegment'],
  consults: ['film'],
  qloo: { titles: ['urn:entity:book'], ...sharedQlooCoverage },
  baselines: {},
  coverage: { tests: [], thin: [], notSupported: [] },
};
