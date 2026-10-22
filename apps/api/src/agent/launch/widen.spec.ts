import { describe, expect, it } from 'vitest';
import { alternativesOf, wideningsOf } from './findings.js';

describe('wideningsOf', () => {
  it('drops the narrowest filter first, one step at a time', () => {
    const steps = wideningsOf({
      type: 'urn:entity:artist',
      tags: ['urn:tag:genre:music:afrobeats'],
      city: 'Lagos',
      ages: ['25_to_29'],
    });
    expect(steps.map((s) => s.dropped)).toEqual([['the age band'], ['the age band', 'the city']]);
    expect(steps[1]?.shape).toMatchObject({ city: null, ages: [] });
  });

  it('never leaves a query with nothing to shape it', () => {
    const steps = wideningsOf({ type: 'urn:entity:tv_show', city: 'Lagos', yearFrom: 2020 });
    expect(steps.map((s) => s.dropped)).toEqual([['the release years']]);
  });

  it('keeps the city of a place list and widens nothing it was told to rank', () => {
    expect(wideningsOf({ type: 'urn:entity:place', tags: ['t'], city: 'Lagos' })).toEqual([]);
    expect(wideningsOf({ type: 'urn:entity:brand', city: 'Lagos', only: ['a', 'b'] })).toEqual([]);
  });
});

describe('alternativesOf', () => {
  it('offers the genre tag, the release country and the popularity band, one off at a time', () => {
    const alts = alternativesOf({
      type: 'urn:entity:movie',
      tags: ['urn:tag:genre:media:crime'],
      city: 'Lagos',
      country: 'Nigeria',
      popularity: { min: 0.1, max: 0.9 },
    });
    expect(alts.map((a) => a.key)).toEqual(['no-tags', 'no-country', 'no-band']);
    expect(alts[0]?.shape).toMatchObject({ tags: [], country: 'Nigeria' });
  });

  it('never drops the category tag of a place or brand list, which would make it a list of anything', () => {
    expect(alternativesOf({ type: 'urn:entity:place', tags: ['cinema'], city: 'Lagos' })).toEqual(
      [],
    );
    expect(alternativesOf({ type: 'urn:entity:brand', tags: ['drinks'], city: 'Lagos' })).toEqual(
      [],
    );
  });

  it('offers nothing that would leave the query with nothing to shape it', () => {
    expect(
      alternativesOf({ type: 'urn:entity:movie', tags: ['urn:tag:genre:media:crime'] }),
    ).toEqual([]);
  });

  it('offers nothing for a list the team chose to rank', () => {
    expect(alternativesOf({ type: 'urn:entity:brand', only: ['a', 'b'], country: 'X' })).toEqual(
      [],
    );
  });
});
