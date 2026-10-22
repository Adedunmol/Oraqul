import { rulesResponseSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { rulesView } from './rules.view.js';

describe('rulesView', () => {
  const view = rulesView();

  it('matches the response schema, one library per category', () => {
    expect(rulesResponseSchema.safeParse(view).success).toBe(true);
    expect(view.libraries.map((l) => l.category)).toEqual([
      'film',
      'music',
      'books',
      'podcasts',
      'games',
    ]);
  });

  it('gives every rule a source and a date', () => {
    for (const lib of view.libraries) {
      for (const r of [...lib.timeline, lib.signal, lib.channels]) {
        expect(r.source.label).toBeTruthy();
        expect(r.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('lists the bands in order and the three partner tiers', () => {
    expect(view.bands.map((b) => b.id)).toEqual(['micro', 'independent', 'mid', 'major']);
    expect(view.tiers.map((t) => t.tier)).toEqual(['A', 'B', 'C']);
  });
});
