import { categories, projectInputSchema, toolNames } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { demoProjects, packs } from './index';

describe('packs', () => {
  it('has one pack per category, keyed by its own category', () => {
    for (const category of categories) expect(packs[category].category).toBe(category);
  });

  it('only allows tools that exist', () => {
    for (const category of categories) {
      for (const name of packs[category].toolAllowlist) expect(toolNames).toContain(name);
    }
  });

  it('lets only Books consult, and only Film (spec §3.4)', () => {
    for (const category of categories) {
      const expected = category === 'books' ? ['film'] : [];
      expect(packs[category].consults).toEqual(expected);
    }
  });
});

describe('demoProjects', () => {
  it('are valid projects in their own category', () => {
    for (const category of categories) {
      expect(projectInputSchema.parse(demoProjects[category]).category).toBe(category);
    }
  });
});
