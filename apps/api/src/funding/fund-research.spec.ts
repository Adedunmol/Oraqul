import { describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (orig) => {
  const real = await orig<typeof import('ai')>();
  return { ...real, generateText: vi.fn() };
});

import { generateText } from 'ai';
import { fundSearchPrompt, ModelFundingResearcher, verifyFunds } from './fund-research.js';

const page = (text: string, url = 'https://funds.example/open') => ({
  title: 'Open funds',
  url,
  fetched: { url, text, retrievedAt: '2026-10-27' },
});
const base = {
  owner: null,
  type: 'grant' as const,
  amountText: null,
  deadlineText: null,
  deadlineIso: null,
  applicationUrl: null,
  otherConditions: false,
  criteria: [],
  source: 1,
};
const TODAY = '2026-10-27';

describe('verifyFunds', () => {
  const text =
    'Lagos Film Development Grant, run by Arts Council. Up to £25,000. Closing date: 31 January 2027. Open to feature film projects in development. Apply at https://funds.example/apply';

  it('keeps a field only when the page holds the words, with the day the page was read', () => {
    const [fund] = verifyFunds(
      [
        {
          ...base,
          name: 'Lagos Film Development Grant',
          owner: 'Arts Council',
          amountText: '£25,000',
          deadlineText: '31 January 2027',
          deadlineIso: '2027-01-31',
          applicationUrl: 'https://funds.example/apply',
          criteria: [
            { field: 'stage', value: 'development', quote: 'feature film projects in development' },
          ],
        },
      ],
      [page(text)],
      TODAY,
    );
    expect(fund).toMatchObject({
      name: 'Lagos Film Development Grant',
      owner: 'Arts Council',
      amount: '£25,000',
      currency: '£',
      deadline: '2027-01-31',
      applicationUrl: 'https://funds.example/apply',
      sourceUrl: 'https://funds.example/open',
      retrievedAt: '2026-10-27',
      otherConditions: false,
    });
    expect(fund?.criteria).toEqual([
      { text: 'feature film projects in development', field: 'stage', value: 'development' },
    ]);
  });

  it('drops a fund whose page does not contain the claimed amount', () => {
    expect(
      verifyFunds(
        [{ ...base, name: 'Lagos Film Development Grant', amountText: '£250,000' }],
        [page(text)],
        TODAY,
      ),
    ).toEqual([]);
  });

  it('drops a fund whose page does not contain the claimed deadline, or whose date disagrees with its words', () => {
    const wrong = {
      ...base,
      name: 'Lagos Film Development Grant',
      deadlineText: '28 February 2027',
      deadlineIso: '2027-02-28',
    };
    expect(verifyFunds([wrong], [page(text)], TODAY)).toEqual([]);
    const lies = {
      ...base,
      name: 'Lagos Film Development Grant',
      deadlineText: '31 January 2027',
      deadlineIso: '2027-03-01',
    };
    expect(verifyFunds([lies], [page(text)], TODAY)).toEqual([]);
  });

  it('drops a deadline already past, and a fund the page does not name', () => {
    const closed = 'Old Fund. Closing date: 15 March 2026.';
    expect(
      verifyFunds(
        [{ ...base, name: 'Old Fund', deadlineText: '15 March 2026', deadlineIso: '2026-03-15' }],
        [page(closed)],
        TODAY,
      ),
    ).toEqual([]);
    expect(verifyFunds([{ ...base, name: 'Invented Fund' }], [page(text)], TODAY)).toEqual([]);
  });

  it('stores an unknown field as null, never a guess', () => {
    const [fund] = verifyFunds(
      [
        {
          ...base,
          name: 'Lagos Film Development Grant',
          owner: 'Somebody Else',
          applicationUrl: 'https://made.up/apply',
        },
      ],
      [page(text)],
      TODAY,
    );
    expect(fund).toMatchObject({
      owner: null,
      amount: null,
      currency: null,
      deadline: null,
      applicationUrl: null,
    });
  });

  it('does not claim a criterion the page does not hold, and marks the fund as not fully read', () => {
    const [fund] = verifyFunds(
      [
        {
          ...base,
          name: 'Lagos Film Development Grant',
          criteria: [{ field: 'nationality', value: 'Nigerian', quote: 'must be Nigerian' }],
        },
      ],
      [page(text)],
      TODAY,
    );
    expect(fund?.criteria).toEqual([]);
    expect(fund?.otherConditions).toBe(true);
  });
});

describe('ModelFundingResearcher', () => {
  const finder = (fetched: ReturnType<typeof page>['fetched']) =>
    new ModelFundingResearcher(
      async () => ({
        text: 'notes',
        sources: [{ title: 'Open funds', url: 'https://funds.example/open' }],
        tokens: 3,
      }),
      {} as never,
      1000,
      async () => fetched,
    );

  it('sends the kind of work, stage, nationality and places to the search, never a title', () => {
    const prompt = fundSearchPrompt({
      category: 'film',
      stage: 'development',
      nationality: 'Nigerian',
      territories: ['Lagos', 'London'],
      today: TODAY,
    });
    expect(prompt).toContain(
      'film project at the development stage made by Nigerian producers, in or for Lagos, London',
    );
  });

  it('keeps sponsorship evidence only when the page holds the brand and a recent year', async () => {
    const text = 'Guinness Nigeria sponsored the Lagos Film Festival in 2026 as headline partner.';
    const researcher = finder({ url: 'https://news.example/a', text, retrievedAt: '2026-10-27' });
    vi.mocked(generateText).mockResolvedValue({
      output: {
        found: { quote: 'Guinness Nigeria sponsored the Lagos Film Festival in 2026', source: 1 },
      },
      usage: { totalTokens: 4 },
    } as never);
    const ok = await researcher.evidence({
      brand: 'Guinness',
      category: 'film',
      territory: 'Lagos',
      today: TODAY,
    });
    expect(ok.evidence).toMatchObject({ url: 'https://news.example/a', retrievedAt: '2026-10-27' });

    vi.mocked(generateText).mockResolvedValue({
      output: {
        found: { quote: 'Guinness Nigeria sponsored the Lagos Film Festival in 2019', source: 1 },
      },
      usage: { totalTokens: 4 },
    } as never);
    const old = await researcher.evidence({
      brand: 'Guinness',
      category: 'film',
      territory: 'Lagos',
      today: TODAY,
    });
    expect(old.evidence).toBeNull();

    vi.mocked(generateText).mockResolvedValue({
      output: { found: { quote: 'MTN sponsored the Lagos Film Festival in 2026', source: 1 } },
      usage: { totalTokens: 4 },
    } as never);
    const wrongBrand = await researcher.evidence({
      brand: 'MTN',
      category: 'film',
      territory: 'Lagos',
      today: TODAY,
    });
    expect(wrongBrand.evidence).toBeNull();
  });
});
