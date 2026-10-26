import type { Finding } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { rankedBrand } from './follow-ups.js';

const finding = (query: string, names: [string, string | null][]): Finding => ({
  id: `f-${query}`,
  query,
  text: '',
  entities: names.map(([name, entityId]) => ({ entityId, name, affinity: null, detail: null })),
  numbers: {},
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city: 'Lagos', ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
});

describe('rankedBrand: the brand a plan ranked, by the name asked or a fuller one', () => {
  const plan = {
    plan: {
      findings: [
        finding('brands', [
          ['MTN Group', 'brand-mtn'],
          ['Guinness Nigeria', 'brand-guinness'],
          ['Unfound', null],
        ]),
        finding('cities', [['MTN Plaza', 'place-1']]),
      ],
    },
  };

  it('finds a brand written without its full name', () => {
    expect(rankedBrand(plan, 'MTN')).toEqual({ name: 'MTN Group', entityId: 'brand-mtn' });
    expect(rankedBrand(plan, 'guinness nigeria')?.entityId).toBe('brand-guinness');
  });

  it('ignores names that only share letters, other findings and brands with no Qloo id', () => {
    expect(rankedBrand(plan, 'MT')).toBeNull();
    expect(rankedBrand(plan, 'MTN Plaza')).toBeNull();
    expect(rankedBrand(plan, 'Unfound')).toBeNull();
    expect(rankedBrand({ plan: null }, 'MTN')).toBeNull();
  });
});
