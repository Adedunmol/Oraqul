import { type SampledPlan, tallyCannot } from './error-sample.js';

const plan = (id: string, cannot: [string, string][], dropped = 0): SampledPlan => ({
  id,
  category: 'film',
  headline: null,
  confidence: 'medium',
  cannot: cannot.map(([item, why]) => ({ item, why })),
  dropped,
});

describe('tallyCannot', () => {
  it('counts the plans that could not test an item, most common first', () => {
    const tally = tallyCannot([
      plan('1', [
        ['Box office', 'Not in Qloo'],
        ['Podcasts', 'No tag'],
      ]),
      plan('2', [['Box office', 'Not in Qloo']]),
      plan('3', [
        ['Podcasts', 'No tag'],
        ['Podcasts', 'Other reason'],
      ]),
    ]);
    expect(tally.map((t) => [t.key, t.count])).toEqual([
      ['Box office', 2],
      ['Podcasts', 2],
    ]);
  });

  it('counts a plan once for an item and gives its most common reason', () => {
    const tally = tallyCannot([
      plan('1', [
        ['Podcasts', 'No tag'],
        ['Podcasts', 'No tag'],
        ['Podcasts', 'Other'],
      ]),
    ]);
    expect(tally[0]).toEqual({ key: 'Podcasts', count: 1, why: 'No tag' });
  });

  it('is empty for no plans', () => {
    expect(tallyCannot([])).toEqual([]);
  });
});
