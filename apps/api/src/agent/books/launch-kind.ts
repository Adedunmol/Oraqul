import { booksPlan } from '@oraqul/packs';
import type { BooksRead } from './read.js';

/**
 * The launch kind a plan is for. When the brief does not say, the plan assumes a debut and says so
 * (`assumed`), so a missing answer never blocks the plan.
 */
export function kindOf(read: Pick<BooksRead, 'launchKind' | 'previousBooks'>): {
  kind: booksPlan.LaunchKind;
  assumed: boolean;
} {
  if (read.launchKind) return { kind: read.launchKind, assumed: false };
  // Earlier books by the author are not a debut, even when the brief does not say so.
  return read.previousBooks.length
    ? { kind: 'frontlist', assumed: true }
    : { kind: booksPlan.DEFAULT_KIND, assumed: true };
}

/** The route a plan is for: the one read, or a publisher's, with `assumed` set. */
export function routeOf(read: Pick<BooksRead, 'route'>): {
  route: booksPlan.Route;
  assumed: boolean;
} {
  return read.route
    ? { route: read.route, assumed: false }
    : { route: booksPlan.DEFAULT_ROUTE, assumed: true };
}

/** The readership a plan is for: the one read, or adults, with `assumed` set. */
export function readershipOf(read: Pick<BooksRead, 'readership'>): {
  readership: booksPlan.Readership;
  assumed: boolean;
} {
  return read.readership
    ? { readership: read.readership, assumed: false }
    : { readership: booksPlan.DEFAULT_READERSHIP, assumed: true };
}

/** Whether an audiobook is part of the launch. */
export const hasAudio = (read: Pick<BooksRead, 'formats'>): boolean =>
  read.formats.includes('audio');

/** What the launch's beats are for: its route, an audiobook, young readers. */
export function beatTagsOf(read: BooksRead): booksPlan.BeatFor[] {
  return booksPlan.beatTags(routeOf(read).route, hasAudio(read), readershipOf(read).readership);
}
