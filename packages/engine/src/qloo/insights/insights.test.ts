import type { QlooEntityType } from '@oraqul/schema';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { entityInsightsBody, jsonResponse, stubFetch, testClient } from '../fake-fetch';
import type { EntityInsightsRequest } from './filters';
import * as insights from './index';

afterEach(() => vi.unstubAllGlobals());

const sentUrl = (fetch: ReturnType<typeof stubFetch>) => new URL(String(fetch.mock.calls[0]?.[0]));

describe('insights.entities', () => {
  it('sends filter.type and the filters for that type', async () => {
    const fetch = stubFetch(jsonResponse(entityInsightsBody));
    const { data } = await insights.entities(testClient(), {
      'filter.type': 'urn:entity:movie',
      'signal.interests.entities': ['E1'],
      'filter.release_year.min': 2020,
      'filter.content_rating': ['PG-13', 'R'],
      'bias.trends': 'low',
      take: 10,
    });
    const url = sentUrl(fetch);
    expect(url.pathname).toBe('/v2/insights');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'bias.trends': 'low',
      'filter.content_rating': 'PG-13,R',
      'filter.release_year.min': '2020',
      'filter.type': 'urn:entity:movie',
      'signal.interests.entities': 'E1',
      take: '10',
    });
    expect(data.results.entities[0]?.query?.affinity).toBe(0.8);
  });

  it('has a request shape for every entity type', () => {
    expectTypeOf<Exclude<QlooEntityType, EntityInsightsRequest['filter.type']>>().toBeNever();
  });

  it('rejects, at compile time, a filter that belongs to another type', () => {
    const neverRuns = () => {
      insights.entities(testClient(), {
        'filter.type': 'urn:entity:book',
        // @ts-expect-error release_year is for movies and shows; books use publication_year
        'filter.release_year.min': 2020,
      });
      insights.entities(testClient(), {
        'filter.type': 'urn:entity:movie',
        // @ts-expect-error publication_year is for books
        'filter.publication_year.min': 2020,
      });
      // @ts-expect-error destinations require an entity signal
      insights.entities(testClient(), { 'filter.type': 'urn:entity:destination' });
    };
    expect(neverRuns).toBeTypeOf('function');
  });
});

describe('insights.tags', () => {
  it('asks for urn:tag with the given signal', async () => {
    const fetch = stubFetch(
      jsonResponse({ success: true, results: { tags: [{ name: 'Heist', tag_id: 't1' }] } }),
    );
    await insights.tags(testClient(), {
      'signal.interests.entities': ['E1'],
      'filter.tag.types': ['urn:tag:keyword:media'],
    });
    expect(sentUrl(fetch).searchParams.get('filter.type')).toBe('urn:tag');
  });

  it('needs something to anchor on', () => {
    expect(() => insights.tags(testClient(), { take: 5 })).toThrow('need a signal');
    expect(() => insights.tags(testClient(), { 'signal.interests.tags': [] })).toThrow(
      'need a signal',
    );
  });
});

describe('insights.demographics', () => {
  const body = {
    success: true,
    results: {
      demographics: [
        {
          entity_id: 'E1',
          query: { age: { '25_to_29': 0.43 }, gender: { male: 0.08, female: -0.08 } },
        },
      ],
    },
  };

  it('asks for urn:demographics', async () => {
    const fetch = stubFetch(jsonResponse(body));
    const { data } = await insights.demographics(testClient(), {
      'signal.interests.entities': ['E1'],
    });
    expect(sentUrl(fetch).searchParams.get('filter.type')).toBe('urn:demographics');
    expect(data.results.demographics[0]?.query.age?.['25_to_29']).toBe(0.43);
  });

  it('accepts a tag signal and refuses an empty one', async () => {
    stubFetch(jsonResponse(body));
    await insights.demographics(testClient(), {
      'signal.interests.tags': ['urn:tag:genre:media:action'],
    });
    expect(() => insights.demographics(testClient(), {})).toThrow('needs signal');
  });
});

describe('insights.heatmap', () => {
  const cell = {
    location: { latitude: 6.5, longitude: 3.4, geohash: 's14' },
    query: { affinity: 0.9, affinity_rank: 0.99, popularity: 0.7 },
  };

  it('asks for geohash cells in a named place', async () => {
    const fetch = stubFetch(jsonResponse({ success: true, results: { heatmap: [cell] } }));
    const { data } = await insights.heatmap(testClient(), {
      'filter.location.query': 'Lagos',
      'signal.interests.entities': ['E1'],
      take: 20,
    });
    const url = sentUrl(fetch);
    expect(url.searchParams.get('filter.type')).toBe('urn:heatmap');
    expect(url.searchParams.get('output.heatmap.boundary')).toBe('urn:geohash');
    expect(data.results.heatmap[0]?.location.geohash).toBe('s14');
  });

  it('needs a signal, and a place at compile time', () => {
    expect(() => insights.heatmap(testClient(), { 'filter.location.query': 'Lagos' })).toThrow(
      'needs signal',
    );
    const neverRuns = () => {
      // @ts-expect-error a heatmap needs a location
      insights.heatmap(testClient(), { 'signal.interests.entities': ['E1'] });
    };
    expect(neverRuns).toBeTypeOf('function');
  });
});
