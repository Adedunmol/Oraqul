import { MockLanguageModelV4 } from 'ai/test';
import { NoPresenceChecker, presenceKey, WebPresenceChecker } from './brand-presence.js';

function modelSaying(payload: unknown) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 40, noCache: 40, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 6, text: 6, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

const page = { title: 'Cell C', url: 'https://example.test/cellc' };

describe('WebPresenceChecker', () => {
  it('says a brand sells in a country only when a page says so', async () => {
    const search = vi.fn(async () => ({
      text: 'Cell C operates only in South Africa.',
      sources: [page],
      tokens: 1,
    }));
    const checker = new WebPresenceChecker(
      search,
      modelSaying({
        brands: [
          { name: 'Cell C', operates: 'no', source: 1 },
          { name: 'MTN', operates: 'yes', source: 1 },
          { name: 'Verve', operates: 'yes', source: null },
        ],
      }),
      1000,
    );
    const out = await checker.check([
      { name: 'Cell C', country: 'Ghana' },
      { name: 'MTN', country: 'Ghana' },
      { name: 'Verve', country: 'Ghana' },
    ]);
    expect(out.get(presenceKey('Cell C', 'Ghana'))?.state).toBe('absent');
    expect(out.get(presenceKey('MTN', 'Ghana'))?.state).toBe('present');
    // A yes with no page behind it is not a finding.
    expect(out.get(presenceKey('Verve', 'Ghana'))).toEqual({ state: 'unknown', source: null });
    // One search for the country, not one per brand.
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('keeps an answer, so the same brand is not searched twice', async () => {
    const search = vi.fn(async () => ({ text: 'notes', sources: [page], tokens: 1 }));
    const checker = new WebPresenceChecker(
      search,
      modelSaying({ brands: [{ name: 'MTN', operates: 'yes', source: 1 }] }),
      1000,
    );
    await checker.check([{ name: 'MTN', country: 'Ghana' }]);
    await checker.check([{ name: 'MTN', country: 'Ghana' }]);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('never throws: a failed search leaves every brand unknown, and is asked again next time', async () => {
    const search = vi.fn(async () => {
      throw new Error('down');
    });
    const checker = new WebPresenceChecker(search, modelSaying({ brands: [] }), 1000);
    const first = await checker.check([{ name: 'MTN', country: 'Ghana' }]);
    expect(first.get(presenceKey('MTN', 'Ghana'))?.state).toBe('unknown');
    await checker.check([{ name: 'MTN', country: 'Ghana' }]);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('leaves everything unknown with no web search', async () => {
    const out = await new NoPresenceChecker().check([{ name: 'MTN', country: 'Ghana' }]);
    expect(out.get(presenceKey('MTN', 'Ghana'))?.state).toBe('unknown');
  });
});
