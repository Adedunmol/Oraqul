import type { Category, ProjectInput } from '@oraqul/schema';

// Names match the hand-written Qloo stand-in in packages/engine (demo-fetch.ts). PRD A2 asks for a
// demo project in every category; these are that, in code, until accounts and seeding exist.
export const demoProjects: Record<Category, ProjectInput> = {
  film: {
    category: 'film',
    name: 'Midnight Harbor launch',
    kind: 'feature',
    genre: 'thriller',
    places: ['Lagos', 'London'],
    window: 'Q1 next year',
    lead: 'Midnight Harbor',
    comps: ['Salt Road'],
  },
  music: {
    category: 'music',
    name: 'Neon Tide album',
    places: ['Lagos'],
    lead: 'Neon Tide',
    comps: [],
  },
  books: {
    category: 'books',
    name: 'The Glass Lantern launch',
    genre: 'literary fiction',
    places: ['London'],
    lead: 'The Glass Lantern',
    comps: [],
  },
  podcasts: {
    category: 'podcasts',
    name: 'Late Signal season two',
    places: [],
    lead: 'Late Signal',
    comps: [],
  },
  games: {
    category: 'games',
    name: 'Ember Keep release',
    places: [],
    lead: 'Ember Keep',
    comps: [],
  },
};
