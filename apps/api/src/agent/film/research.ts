import type { LanguageModel } from 'ai';
import type { WebSearch } from '../../llm/llm.js';
import {
  FallbackResearcher as LaunchFallbackResearcher,
  ModelResearcher as LaunchModelResearcher,
  type Researcher as LaunchResearcher,
  type ResearchInput as LaunchResearchInput,
  type ResearchKit,
} from '../launch/research.js';
import type { FilmRead } from './read.js';

export { NoResearch, numbered, toSources } from '../launch/research.js';

export type ResearchInput = LaunchResearchInput<FilmRead>;
export type Researcher = LaunchResearcher<FilmRead>;

export const RESEARCH_SYSTEM = `You research the release context for a film or series launch, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the industry and the market in the query (for a Nigerian film, "Nollywood", "Nigeria cinema", "Nigerian films" and the city), never the film:
1. Rivals in the home market: Nollywood-style films (the same industry and genre as the launch) already scheduled to open in the home market in the next twelve months, with titles, release dates and distributors.
2. Timing in the home market: the busiest and quietest months for cinema in the latest annual or half-year box-office report, with the figures and the year.
3. Distribution in the home market: who distributes and exhibits films from this industry, as named in a report or a release listing.
4. Diaspora cities: run one search for EACH other city, for example "Nollywood films cinemas London", "Nigerian movies theaters Houston", "Nollywood Atlanta cinema release". Report the cinema chains showing them and the distributors or promoters that bring them in, and recent titles shown there. If a city gives nothing, say nothing about it.
5. Rules before release: classification or licensing a film needs in each market.

Only report what is about this industry and these markets. Ignore global blockbuster calendars and unrelated releases unless the same audience would choose between them and the launch. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the market it is about. If a search finds nothing reliable, leave it out. Never guess a date or a number.`;

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the market or industry it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to launching a film from the industry and markets in the notes: rival releases from that industry, release timing and box-office scale, who distributes and exhibits, and rules before release. Drop general film-industry news, releases from other industries or other genres, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a title or a figure to a vague one. Do not add anything the notes do not say.`;

// The industry's own name in searches, which finds far more than the country alone.
function industryOf(country: string): string {
  const names: Record<string, string> = {
    nigeria: 'Nollywood and Nigerian cinema',
    ghana: 'Ghallywood and Ghanaian cinema',
    india: 'Bollywood and Indian cinema',
    'south korea': 'Korean cinema',
    'south africa': 'South African cinema',
    kenya: 'Kenyan cinema',
  };
  return names[country.toLowerCase()] ?? `${country} cinema`;
}

const filmKit: ResearchKit<FilmRead> = {
  searchSystem: RESEARCH_SYSTEM,
  extractSystem: EXTRACT_SYSTEM,
  prompt({ read, country, cities, today }) {
    const kind = read.format === 'series' ? 'series' : 'film';
    const genre = read.genre ? `${read.genre} ` : '';
    return [
      `Today is ${today}.`,
      `Launch: a ${genre}${kind}${country ? ` from ${country}` : ''}${country ? ` (search for it as ${industryOf(country)})` : ''}.`,
      `Markets: ${cities.join(', ')}${country ? `. The home market is in ${country}` : ''}.`,
      read.route ? `Release route: ${read.route}.` : '',
      read.window ? `Release window: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/**
 * Web research for release timing and the market. The film's title and story are never sent, so an
 * unreleased name stays private.
 */
export class ModelResearcher extends LaunchModelResearcher<FilmRead> {
  constructor(search: WebSearch, extract: LanguageModel, timeoutMs: number) {
    super(search, extract, timeoutMs, filmKit);
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher extends LaunchFallbackResearcher<FilmRead> {}
