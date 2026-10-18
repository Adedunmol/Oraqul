import type { LanguageModel } from 'ai';
import type { WebSearch } from '../../llm/llm.js';
import {
  FallbackResearcher as LaunchFallbackResearcher,
  ModelResearcher as LaunchModelResearcher,
  type Researcher as LaunchResearcher,
  type ResearchInput as LaunchResearchInput,
  type ResearchKit,
} from '../launch/research.js';
import type { MusicRead } from './read.js';

export { NoResearch } from '../launch/research.js';

export type ResearchInput = LaunchResearchInput<MusicRead>;
export type Researcher = LaunchResearcher<MusicRead>;

export const RESEARCH_SYSTEM = `You research the release and touring context for a music launch, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the scene and the market in the query (for an Afrobeats artist, "Afrobeats", "Nigerian music" and the city), never the artist or the record:
1. Rivals in the home market: releases and tours in the same scene already scheduled in the next twelve months, with titles, dates and who promotes them.
2. Timing in the home market: the busiest and quietest months for releases and live shows in the latest annual or half-year industry report, with the figures and the year.
3. Promotion in the home market: the promoters, radio stations and playlist editors who cover this scene, as named in a report or a listing.
4. Other cities: run one search for EACH other city, for example "Afrobeats concerts London", "Nigerian artists tour Atlanta". Report the venues and promoters that bring this scene in, and recent shows there. If a city gives nothing, say nothing about it.
5. Rules and seasons: festival dates and any licensing a show needs in each market.

Only report what is about this scene and these markets. Ignore global release calendars and unrelated tours unless the same audience would choose between them and the launch. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the market it is about. If a search finds nothing reliable, leave it out. Never guess a date or a number.`;

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the market or scene it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to launching a music release or tour in the scene and markets in the notes: rival releases and tours from that scene, release and show timing, who promotes and broadcasts it, and rules before a show. Drop general music-industry news, releases from other scenes, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a name or a figure to a vague one. Do not add anything the notes do not say.`;

const musicKit: ResearchKit<MusicRead> = {
  searchSystem: RESEARCH_SYSTEM,
  extractSystem: EXTRACT_SYSTEM,
  prompt({ read, country, cities, today }) {
    const genre = read.genre ? `${read.genre} ` : '';
    return [
      `Today is ${today}.`,
      `Launch: a ${genre}${read.releaseType === 'tour' ? 'tour' : 'release'}${country ? ` from ${country}` : ''}.`,
      `Markets: ${cities.join(', ')}${country ? `. The home market is in ${country}` : ''}.`,
      read.window ? `Release or tour window: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/**
 * Web research for release and touring context. The artist's name and the record's title are never
 * sent, so an unreleased name stays private.
 */
export class ModelResearcher extends LaunchModelResearcher<MusicRead> {
  constructor(search: WebSearch, extract: LanguageModel, timeoutMs: number) {
    super(search, extract, timeoutMs, musicKit);
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher extends LaunchFallbackResearcher<MusicRead> {}
