import { describe, expect, it } from 'vitest';
import { hasParam, serializeParams } from './params';

describe('serializeParams', () => {
  it('sorts keys, joins lists with commas and writes numbers and booleans as text', () => {
    expect(
      serializeParams({
        take: 10,
        'feature.explainability': true,
        'filter.tags': ['urn:tag:genre:media:drama', 'urn:tag:genre:media:comedy'],
        'filter.type': 'urn:entity:movie',
      }),
    ).toEqual({
      'feature.explainability': 'true',
      'filter.tags': 'urn:tag:genre:media:drama,urn:tag:genre:media:comedy',
      'filter.type': 'urn:entity:movie',
      take: '10',
    });
    expect(Object.keys(serializeParams({ b: 1, a: 2 }))).toEqual(['a', 'b']);
  });

  it('keeps zero and false', () => {
    expect(serializeParams({ offset: 0, 'feature.explainability': false })).toEqual({
      offset: '0',
      'feature.explainability': 'false',
    });
  });

  it('drops undefined, empty text and empty lists', () => {
    expect(
      serializeParams({ a: undefined, b: '', c: [], 'signal.interests.tags': [], d: 'kept' }),
    ).toEqual({ d: 'kept' });
  });
});

describe('hasParam', () => {
  it('is true only for values Qloo would receive', () => {
    const params = { a: ['x'], b: [], c: '', d: 0, e: undefined };
    expect(hasParam(params, 'a')).toBe(true);
    expect(hasParam(params, 'b')).toBe(false);
    expect(hasParam(params, 'c')).toBe(false);
    expect(hasParam(params, 'd')).toBe(true);
    expect(hasParam(params, 'e')).toBe(false);
    expect(hasParam(params, 'missing')).toBe(false);
  });
});
