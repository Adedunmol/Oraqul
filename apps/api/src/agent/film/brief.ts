import {
  buildBrief as buildLaunchBrief,
  type LaunchBrief,
  type BriefResults as LaunchBriefResults,
} from '../launch/brief.js';
import type { FilmRead } from './read.js';

export {
  ageLabel,
  capital,
  confidenceReason,
  round2,
  slug,
  type Tested,
} from '../launch/brief.js';

export type FilmBrief = LaunchBrief;
export type BriefResults = Omit<LaunchBriefResults<FilmRead>, 'labels'>;

export function buildBrief(r: BriefResults): FilmBrief {
  return buildLaunchBrief({
    ...r,
    labels: {
      marketNoun: r.read.format ?? 'title',
      compsClaim: 'The comps describe one audience',
      sales: {
        item: 'Box office and viewing numbers',
        reason: 'Qloo has taste data, not sales. Add your own numbers when you fix a plan.',
      },
    },
  });
}
