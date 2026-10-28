import { afterEach, describe, expect, it, vi } from 'vitest';
import { findPlace } from './place-lookup';
import { cityBox, cityCountry } from './places';
import { jsonResponse, stubFetch, testClient } from './qloo/fake-fetch';

afterEach(() => vi.unstubAllGlobals());

const locality = (
  name: string,
  popularity: number,
  country: string,
  boundaries: string,
  level = 6,
) => ({
  entity_id: `${name}-${country}`,
  name,
  popularity,
  properties: {
    admin_level: level,
    boundaries,
    akas: [{ value: `${name}, ${country}` }],
    ancestors: [{ name: country, place: 'country' }],
  },
});

describe('findPlace', () => {
  it('registers the middle of the boundary and the country, so the city can be ranked', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [
          locality(
            'Kumasi Metropolitan District',
            0.98,
            'Ghana',
            'POLYGON ((-1.71 6.75, -1.57 6.75, -1.57 6.63, -1.71 6.63, -1.71 6.75))',
          ),
        ],
      }),
    );
    const { place } = await findPlace(testClient(), 'Kumasi', null);
    expect(place?.country).toBe('Ghana');
    expect(place?.centre[0]).toBeCloseTo(6.69, 2);
    expect(place?.centre[1]).toBeCloseTo(-1.64, 2);
    expect(cityCountry('Kumasi')).toBe('Ghana');
    const box = cityBox('kumasi');
    expect(box && box.east - box.west).toBeCloseTo(0.6, 5);
  });

  it('prefers the place in the launch country, then the most popular', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [
          locality('Springfield', 0.99, 'United States of America', 'POINT (-89.6 39.7)'),
          locality('Springfield', 0.5, 'Australia', 'POINT (152.9 -27.7)'),
        ],
      }),
    );
    const { place } = await findPlace(testClient(), 'Springfield', 'Australia');
    expect(place?.country).toBe('Australia');
  });

  it('maps the US name Qloo uses to the table’s', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [locality('Tulsa', 0.9, 'United States of America', 'POINT (-95.99 36.15)')],
      }),
    );
    expect((await findPlace(testClient(), 'Tulsa', null)).place?.country).toBe('United States');
  });

  it('skips neighbourhoods and places with another name, and finds nothing for a made-up name', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [
          locality('Adum', 0.95, 'Ghana', 'POINT (-1.62 6.69)', 10),
          locality('Elsewhere', 0.9, 'Ghana', 'POINT (0 0)'),
        ],
      }),
    );
    const { place } = await findPlace(testClient(), 'Nowhereville', null);
    expect(place).toBeNull();
    expect(cityBox('Nowhereville')).toBeNull();
  });
});

describe('citiesNear for a city outside the table', () => {
  it('offers the table cities of the launch country when the city has no region', async () => {
    const { citiesNear } = await import('./places');
    expect(citiesNear(['Kochi'], 4, 'India')).toEqual(['Mumbai', 'Delhi']);
    expect(citiesNear(['Kochi'], 4)).toEqual([]);
    expect(citiesNear(['Kochi'], 4, 'Atlantis')).toEqual([]);
  });

  it('keeps using the region of a table city first', async () => {
    const { citiesNear } = await import('./places');
    expect(citiesNear(['Lagos'], 4, 'India')).toEqual(['Abuja', 'Accra']);
  });
});
