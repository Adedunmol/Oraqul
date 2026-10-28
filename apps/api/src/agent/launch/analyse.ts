import { cityNames } from '@oraqul/engine';
import type { Understanding } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { normalise } from '../router/decide.js';
import { ageBands, type LaunchRead, unique } from './read-core.js';

const MAX_CRITERIA = 8;

/** What the model returns. Flat, so every provider accepts the schema. */
export const analysisSchema = z.object({
  asked: z.string().min(1),
  goals: z.array(z.string().min(1)).max(5),
  constraints: z.array(z.string().min(1)).max(5),
  inferred: z
    .array(
      z.object({
        field: z.enum(['genre', 'country', 'places', 'ages', 'window', 'audience', 'other']),
        value: z.string().min(1),
        why: z.string().min(1),
      }),
    )
    .max(8),
  criteria: z
    .array(z.object({ text: z.string().min(1), evidence: z.boolean() }))
    .min(2)
    .max(MAX_CRITERIA),
});
export type Analysis = z.infer<typeof analysisSchema>;

export interface AnalyseInput<R extends LaunchRead = LaunchRead> {
  category: string;
  title: string;
  /** The person's own words: the brief, its files and this run's message. */
  text: string;
  read: R;
}

export interface Analyst {
  analyse<R extends LaunchRead>(
    input: AnalyseInput<R>,
  ): Promise<{ analysis: Analysis | null; tokens: number }>;
}

export const ANALYST_SYSTEM = `You are the first step of Oraqul, a launch planner for media and entertainment that grounds every claim in Qloo taste data. Before anything is searched, you work out what the person actually needs.

You get the request as written and what a reader already pulled out of it. Return:
- asked: one sentence on what they want back (a full launch plan, one decision, a comparison, a review of a plan).
- goals: what they are trying to achieve, in their terms. Constraints: budget, timing, markets to avoid, platforms, anything that limits the plan.
- inferred: only what they did not say but the request makes clear or very likely. Each has a field (genre, country, places, ages, window, audience or other), the value, and why. For places give cities by name, only when the country or origin points to a home market. For ages give Qloo bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). A named person (a cast member, host, author, act or director) who is well known points to a genre and a home market: infer them. Never contradict anything the reader already found, and leave a field out when you would be guessing wildly.
- criteria: 3 to 8 checks a good answer must pass for this request, each a short sentence a reviewer could test against the finished plan ("Says which two cities to open in and why", "Answers whether a streaming-first route suits the audience"). Set evidence to true when answering it needs Qloo audience data (cities, audience, partners, placement) and false when it is about following the request (using the budget, window or comps they gave). Always include one that uses what the person gave. Never make a check about what could not be measured; that goes in the next steps, not in the plan.

Plain words. You never write a number or a verdict about an audience.`;

function readSummary(read: LaunchRead): string {
  const part = (label: string, value: string | string[] | null) =>
    value?.length ? [`${label}: ${Array.isArray(value) ? value.join(', ') : value}`] : [];
  return [
    ...part('genre', read.genre),
    ...part('country', read.country),
    ...part('cities', read.places),
    ...part('comps', read.comps),
    ...part('ages', read.ages),
    ...part('window', read.window),
    ...part('partners', read.partners),
  ].join('\n');
}

export class ModelAnalyst implements Analyst {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async analyse<R extends LaunchRead>({ category, title, text, read }: AnalyseInput<R>) {
    const { output, usage } = await generateText({
      model: this.model,
      system: ANALYST_SYSTEM,
      prompt: [
        `Category: ${category}`,
        `Launch title: ${title}`,
        '',
        'Request:',
        text,
        '',
        'Already read from it:',
        readSummary(read) || 'nothing yet',
      ].join('\n'),
      output: Output.object({ schema: analysisSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { analysis: output, tokens: usage.totalTokens ?? 0 };
  }
}

/** With no key, or when the model fails: no inference, only the checks any answer must pass. */
export class ScriptedAnalyst implements Analyst {
  async analyse() {
    return { analysis: null, tokens: 0 };
  }
}

export class FallbackAnalyst implements Analyst {
  constructor(
    private readonly primary: Analyst,
    private readonly fallback: Analyst,
    private readonly onError: (err: unknown) => void,
  ) {}

  async analyse<R extends LaunchRead>(input: AnalyseInput<R>) {
    try {
      return await this.primary.analyse(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.analyse(input);
    }
  }
}

const criterion = (
  n: number,
  text: string,
  evidence: boolean,
): Understanding['criteria'][number] => ({
  id: `c${n}`,
  text,
  evidence,
  status: 'unchecked',
  findingIds: [],
});

const BASE_CRITERIA: [string, boolean][] = [
  ['Answers what the person asked, using the cities, comps, window and budget they gave.', false],
  ['Rests every claim about the audience on measured data, and keeps playbook advice apart.', true],
  ['Gives moves a team can act on this week, not general advice.', false],
];

/**
 * Fills only what the person left empty, and only with values code can use: a city in the city
 * table, a Qloo age band. Anything stated stays as stated, so an inference never overrides a
 * quote, and what was filled is returned as an assumption for the plan to show.
 */
export function applyAnalysis<R extends LaunchRead>(
  read: R,
  analysis: Analysis | null,
): { read: R; understanding: Understanding } {
  if (!analysis) {
    return {
      read,
      understanding: {
        asked: read.scope === 'full' ? 'A launch plan.' : 'An answer to one question.',
        goals: [],
        constraints: [],
        assumed: [],
        criteria: BASE_CRITERIA.map(([text, evidence], i) => criterion(i + 1, text, evidence)),
        by: 'scripted',
      },
    };
  }
  const next = { ...read };
  const assumed: Understanding['assumed'] = [];
  const known = new Map(cityNames().map((c) => [normalise(c), c]));
  for (const { field, value, why } of analysis.inferred) {
    if (field === 'genre' && !next.genre) {
      next.genre = value.trim();
    } else if (field === 'country' && !next.country) {
      next.country = value.trim();
    } else if (field === 'window' && !next.window) {
      next.window = value.trim();
    } else if (field === 'ages' && next.ages.length === 0) {
      const bands = ageBands.filter((b) => value.includes(b));
      if (bands.length === 0) continue;
      next.ages = bands;
    } else if (field === 'places' && next.places.length === 0) {
      const cities = unique(
        value.split(/[,;]/).flatMap((c) => {
          const city = known.get(normalise(c));
          return city ? [city] : [];
        }),
      );
      if (cities.length === 0) continue;
      next.places = cities;
    } else if (field !== 'audience' && field !== 'other') {
      continue;
    }
    assumed.push({ what: field, value: field === 'places' ? next.places.join(', ') : value, why });
  }
  const own = analysis.criteria.map((c, i) => criterion(i + 1, c.text, c.evidence));
  const criteria =
    own.length >= 3
      ? own
      : [
          ...own,
          ...BASE_CRITERIA.map(([text, evidence], i) =>
            criterion(own.length + i + 1, text, evidence),
          ),
        ];
  return {
    read: next,
    understanding: {
      asked: analysis.asked,
      goals: analysis.goals,
      constraints: analysis.constraints,
      assumed,
      criteria: criteria.slice(0, MAX_CRITERIA),
      by: 'model',
    },
  };
}

/** The analyst's view of the request, for the writer's prompt. */
export function understandingBlock(u: Understanding): string {
  return [
    `What they want: ${u.asked}`,
    ...(u.goals.length ? [`Goals: ${u.goals.join('; ')}`] : []),
    ...(u.constraints.length ? [`Constraints: ${u.constraints.join('; ')}`] : []),
    ...(u.assumed.length
      ? [
          'Assumed, not said by the person (never present these as their words; say "assuming" when a line rests on one):',
          ...u.assumed.map((a) => `- ${a.what}: ${a.value} (${a.why})`),
        ]
      : []),
    'A good answer must:',
    ...u.criteria.map((c) => `- ${c.text}`),
  ].join('\n');
}
