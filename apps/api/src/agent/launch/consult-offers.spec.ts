import { describe, expect, it } from 'vitest';
import { booksLaunch } from '../books/config.js';
import { filmLaunch } from '../film/config.js';
import { gamesLaunch } from '../games/config.js';
import { musicLaunch } from '../music/config.js';
import { podcastsLaunch } from '../podcasts/config.js';

// Offers come from names the team gave, so the same brief offers the same consults every time and
// a brief that names nothing offers none.
describe('consult offers', () => {
  it('offers none when the team named nothing to ask about', () => {
    expect(filmLaunch.consults?.(filmLaunch.emptyRead)).toEqual([]);
    expect(booksLaunch.consults?.(booksLaunch.emptyRead)).toEqual([]);
    expect(gamesLaunch.consults?.(gamesLaunch.emptyRead)).toEqual([]);
    expect(podcastsLaunch.consults?.(podcastsLaunch.emptyRead)).toEqual([]);
  });

  it('offers Film’s soundtrack artists to the Music side, at most two, in the team’s order', () => {
    const offers = filmLaunch.consults?.({
      ...filmLaunch.emptyRead,
      soundtrack: ['Tems', 'Rema', 'Asake'],
    });
    expect(offers?.map((o) => [o.category, o.name, o.types])).toEqual([
      ['music', 'Tems', ['urn:entity:artist']],
      ['music', 'Rema', ['urn:entity:artist']],
    ]);
  });

  it('leaves Books’ first screen title to the fixed Film consult and offers the next ones', () => {
    const offers = booksLaunch.consults?.({
      ...booksLaunch.emptyRead,
      screenTitles: ['Shadow and Bone', 'Bridgerton', 'Normal People'],
    });
    expect(offers?.map((o) => [o.category, o.name])).toEqual([
      ['film', 'Bridgerton'],
      ['film', 'Normal People'],
    ]);
  });

  it('offers Games’ collabs for any medium, and Podcasts’ guests as artists', () => {
    const games = gamesLaunch.consults?.({ ...gamesLaunch.emptyRead, collabs: ['Burna Boy'] });
    expect(games?.[0]?.types).toEqual([
      'urn:entity:artist',
      'urn:entity:movie',
      'urn:entity:tv_show',
    ]);
    const podcasts = podcastsLaunch.consults?.({ ...podcastsLaunch.emptyRead, guests: ['Wizkid'] });
    expect(podcasts?.map((o) => [o.category, o.types])).toEqual([['music', ['urn:entity:artist']]]);
  });

  it('gives Music none: its brief names no screen titles to ask the Film side about', () => {
    expect(musicLaunch.consults).toBeUndefined();
  });
});
