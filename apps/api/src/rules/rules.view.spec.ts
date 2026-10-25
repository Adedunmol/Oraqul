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
      'shows',
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

  it('serves the shared, partner, calendar and live show rules, each with a source and a grade', () => {
    expect(view.shared.version).toMatch(/^shared@/);
    expect(view.partners.version).toMatch(/^partners@/);
    expect(view.calendar.version).toMatch(/^calendar@/);
    expect(view.shows.version).toMatch(/^shows@/);
    expect(Object.keys(view.partners.categories)).toHaveLength(6);
    expect(view.calendar.categories.books?.source.grade).toBe('not-researched');
    expect(view.calendar.categories.film?.source.grade).toBe('directional');
    expect(view.opportunities.version).toMatch(/^opportunities@/);
    expect(Object.keys(view.opportunities.kinds).sort()).toEqual(['area', 'market']);
    for (const r of Object.values(view.shows.rules)) {
      expect(r.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['team', 'directional', 'not-researched']).toContain(r.source.grade);
    }
  });
});
