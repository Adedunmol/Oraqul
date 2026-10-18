import {
  type DraftItem,
  testArtists,
  testPlan as testLaunchPlan,
} from '../launch/audit-verdicts.js';
import type { Grounded } from '../launch/findings.js';
import type { FilmRead } from './read.js';

export { type DraftItem, rankVerdict, sourceOf } from '../launch/audit-verdicts.js';

/** The soundtrack artists a plan names, tested against the artists Qloo ranked for the audience. */
export function filmBeliefs(read: FilmRead, text: string, grounded: Grounded): DraftItem[] {
  return testArtists(read.soundtrack, ['music'], grounded, text, 'your comps’ audience');
}

export function testPlan(input: { read: FilmRead; text: string; grounded: Grounded }): DraftItem[] {
  return testLaunchPlan({ ...input, beliefs: filmBeliefs });
}
