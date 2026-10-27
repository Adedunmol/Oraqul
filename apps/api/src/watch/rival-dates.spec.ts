import { describe, expect, it, vi } from 'vitest';
import { ModelRivalFinder, rivalPrompt } from './rival-dates.js';

// The model steps are replaced: the search returns fixed pages, and `generateText` is not called by
// swapping in a finder subclass that overrides extraction through the same verification path.
vi.mock('ai', async (orig) => {
  const real = await orig<typeof import('ai')>();
  return {
    ...real,
    generateText: vi.fn(async () => ({
      output: {
        releases: [
          { title: 'Salt Road 2', isoDate: '2027-03-12', dateText: '12 March 2027', source: 1 },
          { title: 'Ghost Pier', isoDate: '2027-03-13', dateText: '13 March 2027', source: 1 },
          { title: 'Far Away', isoDate: '2027-09-01', dateText: '1 September 2027', source: 1 },
          { title: 'Mismatch', isoDate: '2027-03-14', dateText: '15 March 2027', source: 1 },
        ],
      },
      usage: { totalTokens: 10 },
    })),
  };
});

const search = {
  release: '2027-03-15',
  today: '2026-10-27',
  spanDays: 28,
  category: 'film',
  kind: 'feature film',
  genre: 'thriller',
  cities: ['Lagos'],
};

describe('ModelRivalFinder', () => {
  const page = {
    url: 'https://listings.example/march',
    retrievedAt: '2026-10-27',
    text: 'Opening 12 March 2027: Salt Road 2. Mismatch opens 14 March 2027. Far Away on 1 September 2027.',
  };
  const finder = new ModelRivalFinder(
    async () => ({
      text: 'notes',
      sources: [{ title: 'March listings', url: page.url }],
      tokens: 5,
    }),
    {} as never,
    1000,
    async () => page,
  );

  it('keeps only a rival whose title and date are both on the cited page and agree', async () => {
    const { rivals, tokens } = await finder.find(search);
    expect(rivals.map((r) => r.title)).toEqual(['Salt Road 2']);
    expect(rivals[0]).toMatchObject({
      date: '2027-03-12',
      evidence: { url: page.url, retrievedAt: '2026-10-27', quote: '12 March 2027' },
    });
    expect(tokens).toBe(15);
  });

  it('sends the kind, genre, cities and dates to the search, never a title', () => {
    const prompt = rivalPrompt(search);
    expect(prompt).toContain('thriller');
    expect(prompt).toContain('Lagos');
    expect(prompt).toContain('2027-02-15');
    expect(prompt).toContain('2027-04-12');
  });
});
