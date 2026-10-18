import { filmPlan } from '@oraqul/packs';
import type { LaunchSection } from '@oraqul/schema';
import {
  type DecisionWords,
  ensureDecisions as ensureLaunchDecisions,
} from '../launch/decisions.js';
import { list } from '../launch/text.js';
import { marketRole } from './writer.js';

export const FILM_DECISIONS: DecisionWords = {
  titles: filmPlan.SECTION_TITLES,
  opening: (home, others, strongest) =>
    `Premiere in ${home}, then open ${list(others)} within the same fortnight, so piracy and spoilers do not get there first.${strongest ? ` Put the most spend and community work into ${strongest}, where your audience is strongest.` : ''}`,
  openingAsPlanned: (cities) => `Open in ${list(cities)} as you planned.`,
  unranked: (cities) =>
    ` Build ${list(cities)} around the diaspora community and partner moves below.`,
  role: marketRole,
  unreadCity:
    'Build the release here on the diaspora community: church and campus screenings, the music and brand partners below, and the cast at opening weekend.',
  comp: (c) =>
    `Pitch the film to buyers and press in the company of ${c}, one of the titles your audience already knows.`,
};

export function ensureDecisions(
  sections: LaunchSection[],
  input: Parameters<typeof ensureLaunchDecisions>[1],
): LaunchSection[] {
  return ensureLaunchDecisions(sections, input, FILM_DECISIONS);
}
