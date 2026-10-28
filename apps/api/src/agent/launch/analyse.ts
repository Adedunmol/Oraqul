import { citiesInCountry, cityCountry, cityNames } from '@oraqul/engine';
import type { Understanding } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { normalise } from '../router/decide.js';
import { ageBands, type LaunchRead, unique } from './read-core.js';

const MAX_CRITERIA = 8;
const MAX_COMPS = 5;
const MIN_COMPS = 3;

/** What the audience's titles are called in a category, for the analyst's prompt. */
const COMP_NOUN: Record<string, string> = {
  film: 'films or series',
  music: 'artists',
  books: 'books',
  podcasts: 'podcasts',
  games: 'video games',
  shows: 'artists, comedians or shows',
};

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
  readers: z
    .object({
      who: z.string().min(1),
      ages: z.array(z.string()),
      consumes: z.string().min(1),
      why: z.string().min(1),
    })
    .nullable(),
  comps: z.array(z.object({ name: z.string().min(1), why: z.string().min(1) })).max(MAX_COMPS),
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
- inferred: only what they did not say but the request makes clear or very likely. Each has a field (genre, country, places, ages, window, audience or other), the value, and why. Never guess where the person is or where they should launch: country and places only when their own words point to one (a nationality, a city, a language, the home of a named person), never from the subject matter or because a market is large. When they say they do not know where to launch, or say nothing about it, leave both out. For places give cities by name, in the country their words point to. For ages give Qloo bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older), only when they gave an age, a life stage (teenagers, students, retirees) or the work is plainly for one age group they named; never a guess at who buys it. A named person (a cast member, host, author, act or director) who is well known points to a genre and a home market: infer them. Never contradict anything the reader already found, and leave a field out when you would be guessing wildly.
- criteria: 3 to 8 checks a good answer must pass for this request, each a short sentence a reviewer could test against the finished plan ("Says which two cities to open in and why", "Answers whether a streaming-first route suits the audience"). Set evidence to true when answering it needs Qloo audience data (cities, audience, partners, placement) and false when it is about following the request (using the budget, window or comps they gave). Always include one that uses what the person gave. Never make a check about what could not be measured; that goes in the next steps, not in the plan.

- readers: who the audience probably is, worked out from the description alone: who they are, their age groups in plain words, what they already read, watch, play or listen to, and one sentence on why. Null when the description says nothing about what the work is.
- comps: only when the description says what the work is (its genre, subject, story or sound), never from the title alone; otherwise an empty list. Choose real, released titles that the readers above already like, so each fits this work's subject and tone and not only what is popular. Match the readers: a book for teenage boys is not compared with a book for their parents. A person cannot be looked up as a signal, so use a person's other work in their place. Add only what it takes to reach 3 to 5 in all with the ones the person named (they are listed under "Already read"). Give each a one-sentence reason. Fewer is better than a guess.

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
        `Titles to choose as comps are ${COMP_NOUN[category] ?? 'titles'}.`,
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

/** A phrase with its closing full stop taken off, so a sentence built around it does not double it. */
const bare = (text: string) => text.trim().replace(/[.\s]+$/, '');

const DEMONYMS: Record<string, string> = {
  nigerian: 'nigeria',
  ghanaian: 'ghana',
  kenyan: 'kenya',
  british: 'united kingdom',
  american: 'united states',
  canadian: 'canada',
  indian: 'india',
  brazilian: 'brazil',
  mexican: 'mexico',
  korean: 'south korea',
  japanese: 'japan',
  australian: 'australia',
  french: 'france',
  german: 'germany',
  spanish: 'spain',
  'south african': 'south africa',
  egyptian: 'egypt',
  jamaican: 'jamaica',
};

/**
 * Whether the person's own words point to this country: they name it, use its nationality, or name
 * one of its cities. An inference that a market is likely does not count.
 */
export function pointsTo(text: string, country: string, places: string[]): boolean {
  // Words only, so a full stop after "Lagos" does not hide it.
  const plain = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const want = plain(country);
  const words = ` ${plain(text)} `;
  if (words.includes(` ${want} `)) return true;
  if (Object.entries(DEMONYMS).some(([d, c]) => c === want && words.includes(` ${d} `)))
    return true;
  const cities = [...places, ...citiesInCountry(country)];
  return cities.some((c) => cityCountry(c) === country && words.includes(` ${plain(c)} `));
}

/**
 * Fills only what the person left empty, and only with values code can use: a city in the city
 * table, a Qloo age band. Anything stated stays as stated, so an inference never overrides a
 * quote, and what was filled is returned as an assumption for the plan to show.
 */
export function applyAnalysis<R extends LaunchRead>(
  read: R,
  analysis: Analysis | null,
  title?: string,
  text = '',
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
      // A home market is only taken from the person's words, never from how big a market is.
      if (!pointsTo(text, value, next.places)) continue;
      next.country = value.trim();
    } else if (field === 'window' && !next.window) {
      next.window = value.trim();
    } else if (field === 'ages' && next.ages.length === 0) {
      const bands = ageBands.filter((b) => value.includes(b));
      if (bands.length === 0) continue;
      next.ages = bands;
    } else if (field === 'places' && next.places.length === 0) {
      // Cities are inferred only inside a country the person's words already point to.
      if (!next.country) continue;
      const cities = unique(
        value.split(/[,;]/).flatMap((c) => {
          const city = known.get(normalise(c));
          return city && cityCountry(city) === next.country ? [city] : [];
        }),
      );
      if (cities.length === 0) continue;
      next.places = cities;
    } else if (field !== 'audience' && field !== 'other') {
      continue;
    }
    assumed.push({ what: field, value: field === 'places' ? next.places.join(', ') : value, why });
  }
  // Comps are chosen from the description, after the person's own, and only to reach three.
  // A title is the same title with or without a series mark or a subtitle ("Fourth Wing (The Empyrean, #1)").
  const key = (t: string) => normalise(t.replace(/\s*\([^)]*\)/g, '').split(':')[0] ?? t);
  const same = (a: string, b: string) => key(a) === key(b);
  const proposed: { name: string; why: string }[] = [];
  if (read.comps.length < MIN_COMPS) {
    for (const c of analysis.comps) {
      const name = c.name.trim();
      if (!name || (title && same(name, title)) || read.comps.some((x) => same(x, name))) continue;
      if (proposed.some((x) => same(x.name, name))) continue;
      proposed.push({ name, why: c.why.trim() });
    }
    next.suggestedComps = proposed.map((c) => c.name).slice(0, MAX_COMPS - read.comps.length);
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
      readers: analysis.readers
        ? {
            who: bare(analysis.readers.who),
            ages: analysis.readers.ages,
            consumes: bare(analysis.readers.consumes),
            why: analysis.readers.why.trim(),
          }
        : null,
      proposed: proposed.slice(0, MAX_COMPS),
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
