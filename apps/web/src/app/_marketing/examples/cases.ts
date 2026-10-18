import type { Category } from '@oraqul/schema';

export interface ExampleCase {
  id: 'film' | 'music' | 'podcasts';
  category: Category;
  job: string;
  /** What the example is, for "Invented data for a made up …". */
  noun: string;
  title: string;
  meta: string;
  why: string;
  /** The seeded output it opens (lib/demo/seed.ts), turned into an id with uuidFrom. */
  outputKey: string;
}

const filmCase: ExampleCase = {
  id: 'film',
  category: 'film',
  job: 'Make a plan',
  noun: 'film',
  title: 'Salt Road',
  meta: 'Crime drama film · UK, Canada and Mexico',
  why: 'A plan for three markets, where Oraqul finds the Mexico release cannot reuse the UK audience.',
  outputKey: 'output:r1:1',
};

// Three launches that each show a different job, category and part of the world.
export const exampleCases: ExampleCase[] = [
  filmCase,
  {
    id: 'music',
    category: 'music',
    job: 'Check my plan',
    noun: 'tour',
    title: 'Neon Hours tour',
    meta: 'Indie pop tour · London, Austin, Toronto, Mexico City, Seoul',
    why: 'A tour plan checked city by city, with cities on four continents ranked in one list.',
    outputKey: 'output:r3:1',
  },
  {
    id: 'podcasts',
    category: 'podcasts',
    job: 'Fix my plan',
    noun: 'podcast',
    title: 'The Long Table',
    meta: 'Podcast, season two · results by region and age band',
    why: 'Season two missed. Oraqul compares who listened with who the plan expected, and rebuilds around them.',
    outputKey: 'output:r6:2',
  },
];

/** Reads ?case= from the address. Anything unknown falls back to the first case. */
export function findCase(raw: unknown): ExampleCase {
  return exampleCases.find((c) => c.id === raw) ?? filmCase;
}
