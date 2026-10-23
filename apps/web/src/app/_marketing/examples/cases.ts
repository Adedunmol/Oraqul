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
}

const filmCase: ExampleCase = {
  id: 'film',
  category: 'film',
  job: 'Make a plan',
  noun: 'film',
  title: 'Night Ferry',
  meta: 'Nigerian thriller · Lagos, London, Houston and Atlanta',
  why: 'One plan for each of four territories, home first, with rival dates checked and a call on each place.',
};

// Three launches that each show a different job, category and part of the world.
export const exampleCases: ExampleCase[] = [
  filmCase,
  {
    id: 'music',
    category: 'music',
    job: 'Make a plan',
    noun: 'release',
    title: 'Night Songs',
    meta: 'Afrobeats album · Lagos, London and Houston',
    why: 'A six to eight week rollout worked back from the release date, led on short video, with the tour route scored.',
  },
  {
    id: 'podcasts',
    category: 'podcasts',
    job: 'Make a plan',
    noun: 'podcast',
    title: 'Cold Case Lagos',
    meta: 'True crime podcast · Lagos and London · micro budget',
    why: 'Days one to sixty are the campaign, judged on downloads per episode, with partners sized to a micro budget.',
  },
];

/** Reads ?case= from the address. Anything unknown falls back to the first case. */
export function findCase(raw: unknown): ExampleCase {
  return exampleCases.find((c) => c.id === raw) ?? filmCase;
}
