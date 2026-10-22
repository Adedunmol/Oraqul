import { describe, expect, it } from 'vitest';
import { wideningsOf } from './findings.js';

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
