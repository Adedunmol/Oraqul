import type { gameProfilesOutputSchema, PlatformShare } from '@oraqul/engine';
import { gamesPlan } from '@oraqul/packs';
import type { z } from 'zod';
import { normalise } from '../router/decide.js';

type Game = z.infer<typeof gameProfilesOutputSchema>['games'][number];

/** The platforms Qloo lists for a game, as our platform keys. */
export function platformsOfGame(game: Pick<Game, 'platforms'>): gamesPlan.Platform[] {
  return gamesPlan.platformsFrom(game.platforms.join(' '));
}

/** How many comps list each platform the team named, of the comps Qloo holds platforms for. */
export function platformShares(
  games: Pick<Game, 'platforms'>[],
  named: readonly gamesPlan.Platform[],
): PlatformShare[] {
  const withData = games.filter((g) => g.platforms.length > 0);
  return named.map((platform) => ({
    platform: gamesPlan.PLATFORM_LABEL[platform],
    listing: withData.filter((g) => platformsOfGame(g).includes(platform)).length,
    withData: withData.length,
  }));
}

/** Every typed tag a game carries, once each, as Qloo writes them. */
export function tagsOfGame(game: Pick<Game, 'tags'>): string[] {
  const all = Object.values(game.tags).flat();
  const seen = new Set<string>();
  return all.filter((t) => {
    const key = normalise(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const hasTags = (g: Pick<Game, 'tags'>) => tagsOfGame(g).length > 0;

/** Comps Qloo holds any tag for. */
export function gamesWithTags(games: Pick<Game, 'tags'>[]): number {
  return games.filter(hasTags).length;
}

/**
 * The tags at least half of the comps carry, most shared first. With fewer than two comps that
 * have tags, nothing is shared.
 */
export function sharedTags(games: Pick<Game, 'tags'>[]): string[] {
  const withTags = games.filter(hasTags);
  if (withTags.length < 2) return [];
  const counts = new Map<string, { name: string; n: number }>();
  for (const g of withTags) {
    for (const t of tagsOfGame(g)) {
      const key = normalise(t);
      counts.set(key, { name: counts.get(key)?.name ?? t, n: (counts.get(key)?.n ?? 0) + 1 });
    }
  }
  const half = Math.ceil(withTags.length / 2);
  return [...counts.values()]
    .filter((c) => c.n >= half)
    .sort((a, b) => b.n - a.n)
    .map((c) => c.name);
}

/** The tags the team named that the comps share. */
export function matchTags(team: readonly string[], shared: readonly string[]): string[] {
  const wanted = new Set(shared.map(normalise));
  return team.filter((t) => wanted.has(normalise(t)));
}

/** The platforms the comps list most, most listed first. */
export function topPlatforms(games: Pick<Game, 'platforms'>[], n = 3): gamesPlan.Platform[] {
  const counts = new Map<gamesPlan.Platform, number>();
  for (const g of games) {
    for (const p of platformsOfGame(g)) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([p]) => p);
}
