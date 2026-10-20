import type { LanguageModel } from 'ai';
import type { WebSearch } from '../../llm/llm.js';
import {
  FallbackResearcher as LaunchFallbackResearcher,
  ModelResearcher as LaunchModelResearcher,
  type Researcher as LaunchResearcher,
  type ResearchInput as LaunchResearchInput,
  type ResearchKit,
} from '../launch/research.js';
import { formatOf, kindOf, platformsOf } from './launch-kind.js';
import type { PodcastsRead } from './read.js';

export { NoResearch } from '../launch/research.js';

export type ResearchInput = LaunchResearchInput<PodcastsRead>;
export type Researcher = LaunchResearcher<PodcastsRead>;

export const RESEARCH_SYSTEM = `You research the release context for a podcast launch, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the subject and the platforms in the query, never the show:
1. Editorial: how Apple Podcasts and Spotify take pitches for new shows and new seasons, with any lead time or deadline the platform's own page states.
2. Rivals: podcasts on the same subject already announced for the next twelve months, with titles, dates and platforms.
3. Sponsors: how new independent podcasts are usually sponsored in the markets named (in-kind, per-episode or network deals), and any rate norm a reliable source gives, with the year of the figure.
4. The audience's market: for each region or community named, how people there listen to podcasts: the usual apps and platforms, whether YouTube is the main place, data costs and languages in use, with the year of the figure.
5. Video only: what a video podcast needs to be listed on YouTube and on the audio platforms, from the platforms' own documentation.

Only report what is about this subject and these platforms. Ignore general podcast-industry news. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the platform it is about. If a search finds nothing reliable, leave it out. Never guess a date or a number.`;

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the platform or subject it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to launching a podcast on this subject on these platforms: editorial pitch rules and lead times, rival releases, sponsor norms, and how people in the named markets listen. Drop general podcast-industry news, shows on other subjects, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a name or a figure to a vague one. Do not add anything the notes do not say.`;

const podcastsKit: ResearchKit<PodcastsRead> = {
  searchSystem: RESEARCH_SYSTEM,
  extractSystem: EXTRACT_SYSTEM,
  prompt({ read, today }) {
    const subject = read.genre ? `${read.genre} ` : '';
    const { kind } = kindOf(read);
    return [
      `Today is ${today}.`,
      `Launch: a ${subject}podcast (${kind === 'debut' ? 'a new show' : 'a new season'}, ${formatOf(read).format}) on ${platformsOf(read).join(', ')}.`,
      read.regions.length ? `Markets: ${read.regions.join(', ')}.` : '',
      read.audienceNote ? `Made for: ${read.audienceNote}.` : '',
      read.window ? `Release window: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/**
 * Web research for editorial rules, rival releases and sponsor norms. The show's name is never
 * sent, so an unannounced title stays private.
 */
export class ModelResearcher extends LaunchModelResearcher<PodcastsRead> {
  constructor(search: WebSearch, extract: LanguageModel, timeoutMs: number) {
    super(search, extract, timeoutMs, podcastsKit);
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher extends LaunchFallbackResearcher<PodcastsRead> {}
