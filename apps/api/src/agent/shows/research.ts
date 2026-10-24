import type { LanguageModel } from 'ai';
import type { WebSearch } from '../../llm/llm.js';
import {
  FallbackResearcher as LaunchFallbackResearcher,
  ModelResearcher as LaunchModelResearcher,
  type Researcher as LaunchResearcher,
  type ResearchInput as LaunchResearchInput,
  type ResearchKit,
} from '../launch/research.js';
import type { ShowsRead } from './read.js';

export { NoResearch } from '../launch/research.js';

export type ResearchInput = LaunchResearchInput<ShowsRead>;
export type Researcher = LaunchResearcher<ShowsRead>;

export const RESEARCH_SYSTEM = `You research the live event context for a single show or a short run, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the kind of show, the scene and the market in the query, never the act:
1. Rivals in the home market: shows of the same kind already announced for the weeks around the date, with titles, dates and venues.
2. Timing in the home market: the busiest and quietest weeks for live events, public holidays and school terms near the date.
3. Promotion in the home market: the promoters, venues, radio stations and listings sites that cover this kind of show, as named in a listing.
4. Other cities: run one search for EACH other city, naming venues and promoters that stage this kind of show.
5. Rules: licensing, curfews and ticketing rules a show needs in each market.

Only report what is about this kind of show and these markets. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the market it is about. If a search finds nothing reliable, leave it out. Never guess a date, a price or a capacity.`;

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the market or scene it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to staging and selling a single live show in the kind of show and markets in the notes: rival shows near the date, timing, who promotes and lists it, and rules before a show. Drop general entertainment news, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a name or a figure to a vague one. Do not add anything the notes do not say.`;

const showsKit: ResearchKit<ShowsRead> = {
  searchSystem: RESEARCH_SYSTEM,
  extractSystem: EXTRACT_SYSTEM,
  prompt({ read, country, cities, today }) {
    const genre = read.genre ? `${read.genre} ` : '';
    return [
      `Today is ${today}.`,
      `Launch: a ${genre}${read.showType ?? 'live show'}${country ? ` from ${country}` : ''}.`,
      `Markets: ${cities.join(', ')}${country ? `. The home market is in ${country}` : ''}.`,
      read.window ? `Show date: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/**
 * Web research for live event context. The act's name and the show's title are never sent, so an
 * unannounced name stays private.
 */
export class ModelResearcher extends LaunchModelResearcher<ShowsRead> {
  constructor(search: WebSearch, extract: LanguageModel, timeoutMs: number) {
    super(search, extract, timeoutMs, showsKit);
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher extends LaunchFallbackResearcher<ShowsRead> {}
