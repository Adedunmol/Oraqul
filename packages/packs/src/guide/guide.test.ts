import { describe, expect, it } from 'vitest';
import { GUIDE_INDEX, GUIDE_PAGES, guideKnowledge } from './index';

describe('guide content', () => {
  it('indexes every page once, in reading order', () => {
    const slugs = GUIDE_INDEX.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual([
      'getting-started',
      'write-a-brief',
      'read-a-plan',
      'categories',
      'after-the-plan',
      'launch-rules',
      'limits',
    ]);
    for (const p of GUIDE_PAGES) expect(slugs).toContain(p.slug);
  });

  it('gives the bot every page, tagged so an answer can name its source', () => {
    const text = guideKnowledge();
    for (const { slug } of GUIDE_INDEX) expect(text).toContain(`[page: ${slug}]`);
    expect(text).toContain('Fix my plan');
    expect(text).toContain('Partner tiers');
    expect(text).not.toContain('undefined');
  });
});
