import type { LanguageModel } from 'ai';
import type { WebSearch } from '../../llm/llm.js';
import {
  FallbackResearcher as LaunchFallbackResearcher,
  ModelResearcher as LaunchModelResearcher,
  type Researcher as LaunchResearcher,
  type ResearchInput as LaunchResearchInput,
  type ResearchKit,
} from '../launch/research.js';
import { hasAudio, kindOf, readershipOf, routeOf } from './launch-kind.js';
import type { BooksRead } from './read.js';

export { NoResearch } from '../launch/research.js';

export type ResearchInput = LaunchResearchInput<BooksRead>;
export type Researcher = LaunchResearcher<BooksRead>;

export const RESEARCH_SYSTEM = `You research the publication context for a book launch, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the genre and the markets in the query, never the book or the author:
1. Festivals and prizes: literary festivals and book fairs in the named markets in the next twelve months, with their dates, and any prize deadline for this genre.
2. Rivals: books in the same genre already announced for the next twelve months, with titles, publication dates and publishers.
3. Retail: how pre-orders and promotions work for this kind of book in the named markets (the main retailers, any lead time the retailer's own page states), and for a self-published book how the main platform handles pre-orders.
4. The readers' market: for each region or community named, where people there buy books: the usual shops, platforms and apps, any local reading communities, the languages in use, with the year of any figure.
5. Young readers only: how school and library lists or book fairs work in the named markets, from official pages.

Only report what is about this genre and these markets. Ignore general publishing-industry news. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the place it is about. If a search finds nothing reliable, leave it out. Never guess a date or a number.`;

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the place or genre it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to launching a book in this genre in these markets: festival and prize dates, rival releases, retailer and pre-order rules, and where readers in the named markets buy books. Drop general publishing news, books in other genres, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a name or a figure to a vague one. Do not add anything the notes do not say.`;

const booksKit: ResearchKit<BooksRead> = {
  searchSystem: RESEARCH_SYSTEM,
  extractSystem: EXTRACT_SYSTEM,
  prompt({ read, today }) {
    const genre = read.genre ? `${read.genre} ` : '';
    const { kind } = kindOf(read);
    const { route } = routeOf(read);
    const { readership } = readershipOf(read);
    return [
      `Today is ${today}.`,
      `Launch: a ${genre}book (${kind === 'debut' ? 'a debut' : kind === 'series' ? 'the next book in a series' : kind === 'backlist' ? 'a reissue or new edition' : 'a new book by an author with earlier books'}, ${route === 'indie' ? 'self-published' : 'from a publisher'}, for ${readership === 'ya' ? 'young adult' : readership === 'children' ? 'children' : 'adult'} readers${hasAudio(read) ? ', with an audiobook' : ''}).`,
      read.regions.length ? `Markets: ${read.regions.join(', ')}.` : '',
      read.places.length ? `Cities: ${read.places.join(', ')}.` : '',
      read.audienceNote ? `Made for: ${read.audienceNote}.` : '',
      read.window ? `Publication window: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/**
 * Web research for festival dates, rival releases and retail norms. The book's title and its
 * author are never sent, so an unannounced title stays private.
 */
export class ModelResearcher extends LaunchModelResearcher<BooksRead> {
  constructor(search: WebSearch, extract: LanguageModel, timeoutMs: number) {
    super(search, extract, timeoutMs, booksKit);
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher extends LaunchFallbackResearcher<BooksRead> {}
