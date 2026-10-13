import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityListBody, jsonResponse, stubFetch, testClient } from './fake-fetch';
import * as lookup from './lookup';

afterEach(() => vi.unstubAllGlobals());

const sentUrl = (fetch: ReturnType<typeof stubFetch>) => new URL(String(fetch.mock.calls[0]?.[0]));

describe('lookup', () => {
  it('search sends the query and types', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody));
    await lookup.search(testClient(), {
      query: 'Black Panther',
      types: ['urn:entity:movie', 'urn:entity:tv_show'],
      take: 5,
    });
    const url = sentUrl(fetch);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('query')).toBe('Black Panther');
    expect(url.searchParams.get('types')).toBe('urn:entity:movie,urn:entity:tv_show');
    expect(url.searchParams.get('take')).toBe('5');
  });

  it('entities sorts ids so the same set shares one cache entry', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody));
    const client = testClient();
    await lookup.entities(client, ['B', 'A']);
    await lookup.entities(client, ['A', 'B']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sentUrl(fetch).searchParams.get('entity_ids')).toBe('A,B');
  });

  it('entities needs at least one id', () => {
    expect(() => lookup.entities(testClient(), [])).toThrow('at least one');
  });

  it('entitiesByExternalId uses the source in the parameter name', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody));
    await lookup.entitiesByExternalId(testClient(), 'imdb', ['tt1375666']);
    expect(sentUrl(fetch).searchParams.get('external.imdb.ids')).toBe('tt1375666');
    expect(() => lookup.entitiesByExternalId(testClient(), 'imdb', [])).toThrow('at least one');
  });

  it('tags sends the phrase and options', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: { tags: [{ name: 'Drama', tag_id: 'urn:tag:genre:media:drama' }] },
      }),
    );
    const { data } = await lookup.tags(testClient(), {
      'filter.query': 'drama',
      'feature.typo_tolerance': true,
      take: 3,
    });
    const url = sentUrl(fetch);
    expect(url.pathname).toBe('/v2/tags');
    expect(url.searchParams.get('filter.query')).toBe('drama');
    expect(url.searchParams.get('feature.typo_tolerance')).toBe('true');
    expect(data.results.tags[0]?.tag_id).toBe('urn:tag:genre:media:drama');
  });

  it('audiences and the type lookups hit their own paths', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: { audiences: [{ name: 'Parents', entity_id: 'A1' }] },
      }),
      jsonResponse({ success: true, results: {} }),
      jsonResponse({ success: true, results: {} }),
    );
    const client = testClient();
    await lookup.audiences(client, { 'filter.parents.types': ['urn:audience:life_stage'] });
    await lookup.audienceTypes(client);
    await lookup.tagTypes(client);
    expect(fetch.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/v2/audiences',
      '/v2/audiences/types',
      '/v2/tags/types',
    ]);
  });
});
