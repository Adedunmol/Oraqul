import { gamesPlan } from '@oraqul/packs';
import type { GamesRead } from './read.js';

/**
 * The launch kind a plan is for. When the brief does not say, the plan assumes a paid PC
 * release and says so (`assumed`), so a missing answer never blocks the plan.
 */
export function kindOf(read: Pick<GamesRead, 'launchKind'>): {
  kind: gamesPlan.LaunchKind;
  assumed: boolean;
} {
  return read.launchKind
    ? { kind: read.launchKind, assumed: false }
    : { kind: gamesPlan.DEFAULT_KIND, assumed: true };
}

/** The platforms the plan is for: the ones named, or the kind's usual ones. */
export function platformsOf(
  read: Pick<GamesRead, 'launchKind' | 'platforms'>,
): gamesPlan.Platform[] {
  return read.platforms.length
    ? read.platforms
    : [...gamesPlan.KIND_PROFILES[kindOf(read).kind].defaultPlatforms];
}
