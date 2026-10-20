import type { LanguageModel } from 'ai';
import type { WebSearch } from '../../llm/llm.js';
import {
  FallbackResearcher as LaunchFallbackResearcher,
  ModelResearcher as LaunchModelResearcher,
  type Researcher as LaunchResearcher,
  type ResearchInput as LaunchResearchInput,
  type ResearchKit,
} from '../launch/research.js';
import { kindOf, platformsOf } from './launch-kind.js';
import type { GamesRead } from './read.js';

export { NoResearch } from '../launch/research.js';

export type ResearchInput = LaunchResearchInput<GamesRead>;
export type Researcher = LaunchResearcher<GamesRead>;

export const RESEARCH_SYSTEM = `You research the release context for a video game launch, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the genre and the platforms in the query, never the game:
1. Festivals and showcases: the dates and registration deadlines of the next Steam Next Fest and other store festivals, and the next console showcases, for the platforms named. Give the dates exactly as the official page states them, with the year.
2. Sales: the dates of the next Steam seasonal sales and platform sales, so a release can avoid the start of one.
3. Rivals: games of the same genre already scheduled to release in the next twelve months, with titles, dates and platforms.
4. Platform rules: certification and age rating lead times for the platforms named, and any store rule on dates (for example the Coming Soon page and the release date lock), from the platform's own documentation.
5. Mobile only: the usual soft-launch markets and the pre-registration rules of the iOS and Android stores.
6. The audience's market: for each region or community named, how players there get and pay for games: the usual devices and operating systems, the app stores and their share, data costs, and the payment methods in use (cards, carrier billing, mobile money, vouchers), with the year of the figure.

Only report what is about this genre and these platforms. Ignore general games-industry news. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the platform it is about. If a search finds nothing reliable, leave it out. Never guess a date or a number.`;

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the platform or genre it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to launching a game of this genre on these platforms: festival and showcase dates and deadlines, sale dates, rival releases, platform rules, and how players in the named regions get and pay for games. Drop general games-industry news, releases from other genres, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a name or a figure to a vague one. Do not add anything the notes do not say.`;

const gamesKit: ResearchKit<GamesRead> = {
  searchSystem: RESEARCH_SYSTEM,
  extractSystem: EXTRACT_SYSTEM,
  prompt({ read, today }) {
    const genre = read.genre ? `${read.genre} ` : '';
    const { kind } = kindOf(read);
    return [
      `Today is ${today}.`,
      `Launch: a ${genre}video game (${kind.replace('_', ' ')}) on ${platformsOf(read).join(', ')}.`,
      read.regions.length ? `Regions: ${read.regions.join(', ')}.` : '',
      read.audienceNote ? `Built for: ${read.audienceNote}.` : '',
      read.window ? `Release window: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/**
 * Web research for festival, sale and platform dates. The game's name is never sent, so an
 * unannounced title stays private.
 */
export class ModelResearcher extends LaunchModelResearcher<GamesRead> {
  constructor(search: WebSearch, extract: LanguageModel, timeoutMs: number) {
    super(search, extract, timeoutMs, gamesKit);
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher extends LaunchFallbackResearcher<GamesRead> {}
