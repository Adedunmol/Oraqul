import { afterEach, describe, expect, it, vi } from 'vitest';
import * as analysis from './analysis';
import { jsonResponse, stubFetch, testClient } from './fake-fetch';

afterEach(() => vi.unstubAllGlobals());

describe('analysis.compare', () => {
  it('sends each group under its own prefix, in one call', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: {
          tags: [{ name: 'Drama', query: { score: 0.7 } }],
          a: [{ name: 'Drama', query: { count: '12' } }],
        },
      }),
    );
    const { data } = await analysis.compare(testClient(), {
      a: ['E1', 'E2'],
      b: ['E3'],
      'filter.subtype': 'urn:tag:genre',
      model: 'descriptive',
      take: 20,
    });
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/v2/analysis/compare');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'a.signal.interests.entities': 'E1,E2',
      'b.signal.interests.entities': 'E3',
      'filter.subtype': 'urn:tag:genre',
      model: 'descriptive',
      take: '20',
    });
    expect(data.results.tags?.[0]?.query?.score).toBe(0.7);
  });

  it('needs entities on both sides', () => {
    expect(() => analysis.compare(testClient(), { a: [], b: ['E1'] })).toThrow('both sides');
    expect(() => analysis.compare(testClient(), { a: ['E1'], b: [] })).toThrow('both sides');
  });
});

describe('analysis.trending', () => {
  it('sends the date range and reads weekly points', async () => {
    const point = {
      date: '2026-09-25',
      population_percentile: 85.2,
      population_rank: 150,
      population_rank_velocity: 5,
      velocity_fold_change: 1.15,
      population_percent_delta: 1.15,
    };
    const fetch = stubFetch(jsonResponse({ success: true, results: { trending: [point] } }));
    const { data } = await analysis.trending(testClient(), {
      'filter.type': 'urn:entity:movie',
      'signal.interests.entities': ['E1'],
      'filter.start_date': '2026-09-01',
      'filter.end_date': '2026-10-01',
    });
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/v2/trending');
    expect(url.searchParams.get('filter.start_date')).toBe('2026-09-01');
    expect(data.results.trending[0]?.population_rank).toBe(150);
  });
});
