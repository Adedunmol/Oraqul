import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, testClient } from '../qloo/fake-fetch';
import { tools } from './index';
import { parseAnchor, resolveBundleOutputSchema } from './resolve-bundle';
import type { SeenEntity, ToolContext } from './tool';

afterEach(() => vi.unstubAllGlobals());

function context(): ToolContext {
  return { qloo: testClient(), source: 'demo', entities: new Map<string, SeenEntity>() };
}

const film = (id: string, name: string, year: number, popularity: number) => ({
  entity_id: id,
  name,
  types: ['urn:entity:movie'],
  popularity,
  properties: { release_year: year },
});

describe('parseAnchor', () => {
  it('reads a year in brackets, an IMDb id and a Spotify link out of what the person wrote', () => {
    expect(parseAnchor('Lionheart (2018)')).toEqual({
      title: 'Lionheart',
      year: 2018,
      external: null,
    });
    expect(parseAnchor('Heat tt0113277')).toMatchObject({
      title: 'Heat',
      external: { source: 'imdb', id: 'tt0113277' },
    });
    expect(
      parseAnchor('Burna Boy https://open.spotify.com/artist/3wcj11K77LjEY1PkEazffa?si=x'),
    ).toMatchObject({
      title: 'Burna Boy',
      external: { source: 'spotify', id: '3wcj11K77LjEY1PkEazffa' },
    });
  });

  it('leaves a plain title alone', () => {
    expect(parseAnchor('Dune: Part Two')).toEqual({
      title: 'Dune: Part Two',
      year: null,
      external: null,
    });
  });
});

describe('resolveBundle with a year or an id', () => {
  it('settles two films of one name by the year the person gave', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: [film('A', 'Lionheart', 1990, 0.9), film('B', 'Lionheart', 2018, 0.65)],
      }),
    );
    const { data } = await tools.resolveBundle.run(context(), {
      names: ['Lionheart (2018)'],
      types: ['urn:entity:movie'],
    });
    const out = resolveBundleOutputSchema.parse(data);
    expect(out.anchors[0]).toMatchObject({ status: 'found', entityId: 'B' });
    expect(new URL(String(fetch.mock.calls[0]?.[0])).searchParams.get('query')).toBe('Lionheart');
  });

  it('stays ambiguous when no year is given', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [film('A', 'Lionheart', 1990, 0.9), film('B', 'Lionheart', 2018, 0.65)],
      }),
    );
    const { data } = await tools.resolveBundle.run(context(), {
      names: ['Lionheart'],
      types: ['urn:entity:movie'],
    });
    expect(resolveBundleOutputSchema.parse(data).anchors[0]?.status).toBe('ambiguous');
  });

  it('looks an IMDb id up directly, with no name search', async () => {
    const fetch = stubFetch(jsonResponse({ success: true, results: [film('H', 'Heat', 1995, 1)] }));
    const { data } = await tools.resolveBundle.run(context(), {
      names: ['Heat tt0113277'],
      types: ['urn:entity:movie'],
    });
    expect(resolveBundleOutputSchema.parse(data).anchors[0]).toMatchObject({
      status: 'found',
      entityId: 'H',
    });
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/entities');
    expect(url.searchParams.get('external.imdb.ids')).toBe('tt0113277');
  });

  it('does not take an id that names the wrong kind of entity', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [{ entity_id: 'P', name: 'Someone', types: ['urn:entity:person'] }],
      }),
    );
    const { data } = await tools.resolveBundle.run(context(), {
      names: ['Heat tt0113277'],
      types: ['urn:entity:movie'],
    });
    expect(resolveBundleOutputSchema.parse(data).anchors[0]?.status).toBe('not_found');
  });
});
