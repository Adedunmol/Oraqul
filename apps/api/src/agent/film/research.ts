import type { PlanSource } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { WebSearch } from '../../llm/llm.js';
import type { FilmRead } from './read.js';

/** What a plan may look up on the web: release timing and the market, never the film itself. */
export interface ResearchInput {
  read: FilmRead;
  country: string | null;
  /** The team's cities, home market first. */
  cities: string[];
  /** Today, so "the next twelve months" means something. */
  today: string;
}

export interface Researcher {
  /** False when there is nothing to search with, so the plan skips the step and says nothing about it. */
  readonly enabled: boolean;
  research(input: ResearchInput): Promise<{ sources: PlanSource[]; tokens: number }>;
}

export class NoResearch implements Researcher {
  readonly enabled = false;
  async research() {
    return { sources: [], tokens: 0 };
  }
}

const MAX_FACTS = 12;

export const RESEARCH_SYSTEM = `You research the release context for a film or series launch, for a launch planner. Use web search, and run the separate searches below. Be factual and brief: no advice, no marketing talk.

Search for each of these on its own, naming the industry and the market in the query (for a Nigerian film, "Nollywood", "Nigeria cinema", "Nigerian films" and the city), never the film:
1. Rivals in the home market: Nollywood-style films (the same industry and genre as the launch) already scheduled to open in the home market in the next twelve months, with titles, release dates and distributors.
2. Timing in the home market: the busiest and quietest months for cinema in the latest annual or half-year box-office report, with the figures and the year.
3. Distribution in the home market: who distributes and exhibits films from this industry, as named in a report or a release listing.
4. Diaspora cities: run one search for EACH other city, for example "Nollywood films cinemas London", "Nigerian movies theaters Houston", "Nollywood Atlanta cinema release". Report the cinema chains showing them and the distributors or promoters that bring them in, and recent titles shown there. If a city gives nothing, say nothing about it.
5. Rules before release: classification or licensing a film needs in each market.

Only report what is about this industry and these markets. Ignore global blockbuster calendars and unrelated releases unless the same audience would choose between them and the launch. Write short bullet points. Each states one fact with its date or figure exactly as the source gives it, and names the market it is about. If a search finds nothing reliable, leave it out. Never guess a date or a number.`;

const factsSchema = z.object({
  facts: z
    .array(
      z.object({
        fact: z.string().min(1),
        /** The number of the source in the list, from 1. */
        source: z.number().int().min(1),
      }),
    )
    .max(MAX_FACTS),
});

export const EXTRACT_SYSTEM = `You turn research notes into discrete facts for a launch planner. Each fact is one sentence stating one thing the notes say, with its date or figure exactly as written, and the market or industry it is about. Tie each to the number of the source in the list that supports it best.

Keep a fact only if a listed source supports it and it matters to launching a film from the industry and markets in the notes: rival releases from that industry, release timing and box-office scale, who distributes and exhibits, and rules before release. Drop general film-industry news, releases from other industries or other genres, advice and opinion, and any fact that only says a page exists. Prefer a fact with a date, a title or a figure to a vague one. Do not add anything the notes do not say.`;

/** Facts whose source number is not in the list, or that repeat a page's fact, are dropped. */
export function toSources(
  facts: { fact: string; source: number }[],
  pages: { title: string; url: string }[],
): PlanSource[] {
  const seen = new Set<string>();
  return facts.flatMap(({ fact, source }) => {
    const page = pages[source - 1];
    const key = fact.trim().toLowerCase();
    if (!page || seen.has(key)) return [];
    seen.add(key);
    return [{ id: '', fact: fact.trim(), title: page.title, url: page.url }];
  });
}

/** Gives the sources the ids a line cites, in order: w1, w2, and so on. */
export function numbered(sources: PlanSource[]): PlanSource[] {
  return sources.map((s, i) => ({ ...s, id: `w${i + 1}` }));
}

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

/**
 * Web research for release timing and the market. The film's title and story are never sent, so an
 * unreleased name stays private.
 */
export class ModelResearcher implements Researcher {
  readonly enabled = true;

  constructor(
    private readonly search: WebSearch,
    private readonly extract: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async research({ read, country, cities, today }: ResearchInput) {
    const kind = read.format === 'series' ? 'series' : 'film';
    const genre = read.genre ? `${read.genre} ` : '';
    const prompt = [
      `Today is ${today}.`,
      `Launch: a ${genre}${kind}${country ? ` from ${country}` : ''}${country ? ` (search for it as ${industryOf(country)})` : ''}.`,
      `Markets: ${cities.join(', ')}${country ? `. The home market is in ${country}` : ''}.`,
      read.route ? `Release route: ${read.route}.` : '',
      read.window ? `Release window: ${read.window}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const found = await this.search({
      system: RESEARCH_SYSTEM,
      prompt,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const pages = [...new Map(found.sources.map((s) => [s.url, s])).values()];
    if (pages.length === 0 || !found.text.trim()) return { sources: [], tokens: found.tokens };

    const { output, usage } = await generateText({
      model: this.extract,
      system: EXTRACT_SYSTEM,
      prompt: [
        'Research notes:',
        found.text,
        '',
        'Sources:',
        ...pages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`),
      ].join('\n'),
      output: Output.object({ schema: factsSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return {
      sources: numbered(toSources(output.facts, pages)),
      tokens: found.tokens + (usage.totalTokens ?? 0),
    };
  }
}

/** A failed search never stops a plan: it is written without the web facts. */
export class FallbackResearcher implements Researcher {
  readonly enabled: boolean;

  constructor(
    private readonly primary: Researcher,
    private readonly onError: (err: unknown) => void,
  ) {
    this.enabled = primary.enabled;
  }

  async research(input: ResearchInput) {
    try {
      return await this.primary.research(input);
    } catch (err) {
      this.onError(err);
      return { sources: [], tokens: 0 };
    }
  }
}
