import { podcastsPlan } from '@oraqul/packs';
import type { PodcastsRead } from './read.js';

/**
 * The launch kind a plan is for. When the brief does not say, the plan assumes a new show and
 * says so (`assumed`), so a missing answer never blocks the plan.
 */
export function kindOf(read: Pick<PodcastsRead, 'launchKind'>): {
  kind: podcastsPlan.LaunchKind;
  assumed: boolean;
} {
  return read.launchKind
    ? { kind: read.launchKind, assumed: false }
    : { kind: podcastsPlan.DEFAULT_KIND, assumed: true };
}

/** The format the plan is for: the one read, or audio with `assumed` set. */
export function formatOf(read: Pick<PodcastsRead, 'format'>): {
  format: podcastsPlan.Format;
  assumed: boolean;
} {
  return read.format
    ? { format: read.format, assumed: false }
    : { format: podcastsPlan.DEFAULT_FORMAT, assumed: true };
}

/** The platforms the plan is for: the ones named, or the usual ones for the format. */
export function platformsOf(
  read: Pick<PodcastsRead, 'format' | 'platforms'>,
): podcastsPlan.Platform[] {
  return podcastsPlan.platformsFor(read.platforms, formatOf(read).format);
}
