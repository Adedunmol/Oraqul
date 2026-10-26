import type { PlanSource } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { WebSearch } from '../../llm/llm.js';
import type { LaunchRead } from './read-core.js';

/** What a plan may look up on the web: release timing and the market, never the work itself. */
export interface ResearchInput<R extends LaunchRead = LaunchRead> {
  read: R;
  country: string | null;
  /** The team's cities, home market first. */
  cities: string[];
  /** Today, so "the next twelve months" means something. */
  today: string;
  /** A specific thing the person wants checked, with the work's title already removed. */
  question?: string;
}

export interface Researcher<R extends LaunchRead = LaunchRead> {
  /** False when there is nothing to search with, so the plan skips the step and says nothing about it. */
  readonly enabled: boolean;
  research(input: ResearchInput<R>): Promise<{ sources: PlanSource[]; tokens: number }>;
}

export class NoResearch implements Researcher<LaunchRead> {
  readonly enabled = false;
  async research() {
    return { sources: [], tokens: 0 };
  }
}

const MAX_FACTS = 12;

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

/** What differs by category: what to search for, and what counts as a fact worth keeping. */
export interface ResearchKit<R extends LaunchRead = LaunchRead> {
  searchSystem: string;
  extractSystem: string;
  /** The launch in a few lines, with no title or story, so an unreleased name stays private. */
  prompt(input: ResearchInput<R>): string;
}

/**
 * Web research for release timing and the market. The work's title and story are never sent, so an
 * unreleased name stays private.
 */
export class ModelResearcher<R extends LaunchRead = LaunchRead> implements Researcher<R> {
  readonly enabled = true;

  constructor(
    private readonly search: WebSearch,
    private readonly extract: LanguageModel,
    private readonly timeoutMs: number,
    private readonly kit: ResearchKit<R>,
  ) {}

  async research(input: ResearchInput<R>) {
    const found = await this.search({
      system: this.kit.searchSystem,
      prompt: input.question
        ? `${this.kit.prompt(input)}\n\nAlso find out, from dated sources: ${input.question}`
        : this.kit.prompt(input),
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const pages = [...new Map(found.sources.map((s) => [s.url, s])).values()];
    if (pages.length === 0 || !found.text.trim()) return { sources: [], tokens: found.tokens };

    const { output, usage } = await generateText({
      model: this.extract,
      system: this.kit.extractSystem,
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
export class FallbackResearcher<R extends LaunchRead = LaunchRead> implements Researcher<R> {
  readonly enabled: boolean;

  constructor(
    private readonly primary: Researcher<R>,
    private readonly onError: (err: unknown) => void,
  ) {
    this.enabled = primary.enabled;
  }

  async research(input: ResearchInput<R>) {
    try {
      return await this.primary.research(input);
    } catch (err) {
      this.onError(err);
      return { sources: [], tokens: 0 };
    }
  }
}
