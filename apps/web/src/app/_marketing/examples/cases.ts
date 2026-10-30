import type { Category } from '@oraqul/schema';
import type { ExampleId } from '@/lib/examples';

export interface ExampleCase {
  id: ExampleId;
  category: Category;
  job: string;
  title: string;
  meta: string;
  why: string;
}

const filmCase: ExampleCase = {
  id: 'film',
  category: 'film',
  job: 'Make a plan',
  title: 'Salt Road',
  meta: 'Crime thriller · Atlanta, New York and London',
  why: 'Written from a few sentences and two comps the team named. Each of the three cities gets a call, ranked for the audience those comps share.',
};

// Four launches that each show a different category, led by the largest markets.
export const exampleCases: ExampleCase[] = [
  filmCase,
  {
    id: 'music',
    category: 'music',
    job: 'Make a plan',
    title: 'Night Songs',
    meta: 'R&B album · Atlanta, New York, Los Angeles and London',
    why: 'A tour of four cities in the order the artist gave, each ranked for the audience of three named sound-alikes.',
  },
  {
    id: 'books',
    category: 'books',
    job: 'Make a plan',
    title: 'How to be a man',
    meta: 'Self-help book · no comps named',
    why: 'Written from three sentences with no comps. Oraqul chose comparable books, says so, and ranks the markets for their readers.',
  },
  {
    id: 'podcasts',
    category: 'podcasts',
    job: 'Make a plan',
    title: 'Cold Trails',
    meta: 'True crime podcast · Toronto and Vancouver',
    why: 'Written from a plain description. The comparable shows are Oraqul’s picks and are labelled that way throughout.',
  },
];

/** Reads ?case= from the address. Anything unknown falls back to the first case. */
export function findCase(raw: unknown): ExampleCase {
  return exampleCases.find((c) => c.id === raw) ?? filmCase;
}
