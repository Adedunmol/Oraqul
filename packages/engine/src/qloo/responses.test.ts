import { describe, expect, it } from 'vitest';
import {
  entityInsightsResponseSchema,
  entityListResponseSchema,
  trendingResponseSchema,
} from './responses';

// Each case is a quirk seen in a live Qloo response on 2026-10-13.
describe('response schemas accept what Qloo really sends', () => {
  it('a title with a null or missing popularity', () => {
    const parsed = entityListResponseSchema.parse({
      results: [
        { entity_id: 'E1', name: 'Known', popularity: 0.99 },
        { entity_id: 'E2', name: 'Null popularity', popularity: null },
        { entity_id: 'E3', name: 'No popularity' },
      ],
    });
    expect(parsed.results.map((e) => e.popularity ?? null)).toEqual([0.99, null, null]);
  });

  it('search results have `types` and no `subtype`; insights results have `subtype`', () => {
    const search = entityListResponseSchema.parse({
      results: [{ entity_id: 'E1', name: 'A', types: ['urn:entity:movie'] }],
    });
    expect(search.results[0]?.types).toEqual(['urn:entity:movie']);
    const insights = entityInsightsResponseSchema.parse({
      results: { entities: [{ entity_id: 'E1', name: 'A', subtype: 'urn:entity:movie' }] },
    });
    expect(insights.results.entities[0]?.subtype).toBe('urn:entity:movie');
  });

  it('a tag inside an entity with no name, or with `id` instead of `tag_id`', () => {
    const parsed = entityInsightsResponseSchema.parse({
      results: {
        entities: [
          {
            entity_id: 'E1',
            name: 'A',
            tags: [
              { tag_id: 't1', name: 'Drama', type: 'urn:tag' },
              { id: 't2', type: 'urn:tag' },
            ],
          },
        ],
      },
    });
    expect(parsed.results.entities[0]?.tags).toHaveLength(2);
  });

  it('trending rank written as text', () => {
    const parsed = trendingResponseSchema.parse({
      results: {
        trending: [
          {
            date: '2026-10-12',
            population_percentile: 0.97,
            population_rank: '118',
            population_rank_velocity: 0,
            velocity_fold_change: 0,
            population_percent_delta: 0,
          },
        ],
      },
    });
    expect(parsed.results.trending[0]?.population_rank).toBe('118');
  });
});
