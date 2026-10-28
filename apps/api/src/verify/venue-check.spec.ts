import { describe, expect, it } from 'vitest';
import { NominatimVenueChecker, venueKey } from './venue-check.js';

const answer = (hits: unknown, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(hits), { status })) as unknown as typeof fetch;
const checker = (f: typeof fetch) =>
  new NominatimVenueChecker({ fetch: f, sleep: async () => undefined });
const look = async (f: typeof fetch, name: string, city: string) =>
  (await checker(f).check([{ name, city }])).get(venueKey({ name, city }));

describe('NominatimVenueChecker', () => {
  it('verifies a cinema', async () => {
    const f = answer([
      { class: 'amenity', type: 'cinema', display_name: 'Curzon Mayfair, London' },
    ]);
    expect((await look(f, 'Curzon Mayfair', 'London'))?.state).toBe('verified');
  });

  it('flags a stage theatre as not a screen', async () => {
    const f = answer([
      { class: 'amenity', type: 'theatre', display_name: 'Dolby Theatre, Hollywood' },
    ]);
    expect(await look(f, 'Dolby Theatre', 'Los Angeles')).toEqual({
      state: 'problem',
      kind: 'theatre',
    });
  });

  it('flags a community centre, but not a theatre whose name says it shows films', async () => {
    const hall = answer([
      { class: 'amenity', type: 'community_centre', display_name: 'Cultural Center' },
    ]);
    expect((await look(hall, 'Cultural Center', 'Los Angeles'))?.state).toBe('problem');
    const film = answer([
      { class: 'amenity', type: 'theatre', display_name: 'Film Theatre, Oxford' },
    ]);
    expect((await look(film, 'Film Theatre', 'Oxford'))?.state).toBe('unverified');
  });

  it('leaves a venue unverified when nothing is found or the match is another place', async () => {
    expect((await look(answer([]), 'EbonyLife Place', 'Lagos'))?.state).toBe('unverified');
    const other = answer([
      { class: 'amenity', type: 'theatre', display_name: 'Lyric Hall, Leeds' },
    ]);
    expect((await look(other, 'Egyptian Theatre', 'Los Angeles'))?.state).toBe('unverified');
  });

  it('never throws when the source is down', async () => {
    expect((await look(answer({}, 503), 'Curzon Mayfair', 'London'))?.state).toBe('unverified');
  });

  it('stops looking after the cap, leaving the rest unverified, and keeps answers', async () => {
    let calls = 0;
    const f: typeof fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;
    const c = new NominatimVenueChecker({ fetch: f, sleep: async () => undefined, maxLookups: 2 });
    const items = ['A One', 'B Two', 'C Three'].map((name) => ({ name, city: 'X' }));
    const out = await c.check(items);
    expect(calls).toBe(2);
    expect(out.get(venueKey({ name: 'C Three', city: 'X' }))?.state).toBe('unverified');
    await c.check(items.slice(0, 2));
    expect(calls).toBe(2);
  });
});
