import { describe, expect, it } from 'vitest';
import {
  matchTags,
  platformShares,
  platformsOfGame,
  sharedTags,
  tagsOfGame,
  topPlatforms,
} from './profile.js';

const game = (platforms: string[], steamTags: string[] = [], genres: string[] = []) => ({
  platforms,
  steamTags,
  genres,
  tags: {},
});

const comps = [
  game(['PC (Windows)', 'Nintendo Switch'], ['Roguelike', 'Indie'], ['Action']),
  game(['PC (Windows)', 'PlayStation 5'], ['Roguelike', 'Pixel Graphics'], ['Action']),
  game(['PC (Windows)'], ['Indie', 'Roguelike']),
  game([]),
];

describe('platformShares', () => {
  it('counts the comps that list each platform, of those Qloo holds platforms for', () => {
    expect(platformShares(comps, ['pc', 'switch', 'xbox'])).toEqual([
      { platform: 'PC', listing: 3, withData: 3 },
      { platform: 'Switch', listing: 1, withData: 3 },
      { platform: 'Xbox', listing: 0, withData: 3 },
    ]);
  });
});

describe('platformsOfGame', () => {
  it('reads the platform names Qloo returns for games', () => {
    expect(
      platformsOfGame({
        platforms: [
          'PC (Windows, macOS, Linux)',
          'iOS (iPhone/iPad)',
          'Xbox Series X/S',
          'PlayStation 5',
          'Nintendo Switch 2',
          'Wii U',
        ],
      }),
    ).toEqual(expect.arrayContaining(['pc', 'ios', 'xbox', 'playstation', 'switch']));
  });
});

describe('tags', () => {
  it('lists a comp tag once, however Qloo spells its case', () => {
    expect(tagsOfGame(game([], ['Roguelike', 'roguelike'], ['Action']))).toEqual([
      'Action',
      'Roguelike',
    ]);
  });

  it('shares only what at least half of the comps with tags carry, most shared first', () => {
    expect(sharedTags(comps)).toEqual(['Roguelike', 'Action', 'Indie']);
  });

  it('shares nothing from fewer than two comps with tags', () => {
    expect(sharedTags([game([], ['Roguelike'])])).toEqual([]);
  });

  it('matches the team tags whatever their case', () => {
    expect(matchTags(['roguelike', 'Cozy'], ['Roguelike', 'Action'])).toEqual(['roguelike']);
  });
});

describe('topPlatforms', () => {
  it('orders the platforms the comps list by how many list them', () => {
    expect(topPlatforms(comps, 2)).toEqual(['pc', 'switch']);
  });
});
