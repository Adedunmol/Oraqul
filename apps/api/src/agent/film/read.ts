import { cityNames } from '@oraqul/engine';
import { launchModuleKeys } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { normalise } from '../router/decide.js';

/** Qloo's age bands, as `urn:demographics` returns them. */
export const ageBands = [
  '24_and_younger',
  '25_to_29',
  '30_to_34',
  '35_to_44',
  '45_to_54',
  '55_and_older',
] as const;
export type AgeBand = (typeof ageBands)[number];

export const BAND_RANGES: Record<AgeBand, [number, number]> = {
  '24_and_younger': [0, 24],
  '25_to_29': [25, 29],
  '30_to_34': [30, 34],
  '35_to_44': [35, 44],
  '45_to_54': [45, 54],
  '55_and_older': [55, 200],
};

const quote = z.string().min(1);
const said = <T extends z.ZodType>(value: T) => z.object({ value, quote });

export const releaseRoutes = ['theatrical', 'streaming', 'festival', 'hybrid'] as const;

/** What the model reads from the brief. Every value carries the person's own words. */
export const filmReadingSchema = z.object({
  format: said(z.enum(['film', 'series'])).nullable(),
  genre: said(z.string().min(1)).nullable(),
  logline: said(z.string().min(1)).nullable(),
  /** Country of origin, as a full country name. */
  country: said(z.string().min(1)).nullable(),
  language: said(z.string().min(1)).nullable(),
  cast: z.array(said(z.string().min(1))).max(6),
  director: said(z.string().min(1)).nullable(),
  soundtrack: z.array(said(z.string().min(1))).max(4),
  route: said(z.enum(releaseRoutes)).nullable(),
  /** The budget as written, such as "$50,000". Code reads the number from the quote. */
  budget: said(z.string().min(1)).nullable(),
  /** Partners already signed, as written. They are anchors, never suggested back. */
  partners: z.array(said(z.string().min(1))).max(6),
  /** `full` for a launch plan or an unclear ask, `narrow` for one question such as cities. */
  scope: z.enum(['full', 'narrow']),
  /** The module a narrow ask is about, or null when it is about the core (cities, audience). */
  ask: z.enum(launchModuleKeys).nullable(),
  /** Comparable titles the person named, exactly as written. */
  comps: z.array(said(z.string().min(1))).max(8),
  places: z.array(said(z.string().min(1))).max(12),
  window: said(z.string().min(1)).nullable(),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
  /**
   * Comparable titles the agent proposes when the person named fewer than 3. Not their words, so
   * code checks each one in Qloo and the plan keeps them apart from the person's own.
   */
  suggestedComps: z.array(z.string().min(1)).max(5),
});
export type FilmReading = z.infer<typeof filmReadingSchema>;

export const budgetSchema = z.object({
  /** In the currency's main unit. */
  amount: z.number().positive(),
  /** A symbol or code as written, such as `$` or `NGN`. Empty when none was written. */
  currency: z.string(),
});
export type Budget = z.infer<typeof budgetSchema>;

/** The reading after code kept only what the person said. Stored in a paused run's state. */
export const filmReadSchema = z.object({
  format: z.enum(['film', 'series']).nullable(),
  genre: z.string().nullable(),
  comps: z.array(z.string()),
  places: z.array(z.string()),
  window: z.string().nullable(),
  ages: z.array(z.enum(ageBands)),
  gender: z.enum(['male', 'female']).nullable(),
  suggestedComps: z.array(z.string()),
  // Defaults keep readings saved before these fields existed parseable.
  logline: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  language: z.string().nullable().default(null),
  cast: z.array(z.string()).default([]),
  director: z.string().nullable().default(null),
  soundtrack: z.array(z.string()).default([]),
  route: z.enum(releaseRoutes).nullable().default(null),
  budget: budgetSchema.nullable().default(null),
  partners: z.array(z.string()).default([]),
  scope: z.enum(['full', 'narrow']).default('full'),
  ask: z.enum(launchModuleKeys).nullable().default(null),
});
export type FilmRead = z.infer<typeof filmReadSchema>;

export interface FilmReaderInput {
  title: string;
  /** The first message, the text of its files, and this run's message. */
  text: string;
}

export interface FilmReader {
  read(input: FilmReaderInput): Promise<{ reading: FilmReading; tokens: number }>;
}

function inWords(quoteText: string, text: string): boolean {
  const q = normalise(quoteText);
  return q !== '' && normalise(text).includes(q);
}

/**
 * Keeps only values whose quote is in the person's words. A title must also appear in its own
 * quote, so a model cannot rename a comp. The launch's own title is never a comp.
 */
export function checkReading(reading: FilmReading, { title, text }: FilmReaderInput): FilmRead {
  const kept = <T>(item: { value: T; quote: string } | null): T | null =>
    item && inWords(item.quote, text) ? item.value : null;
  const comps = reading.comps
    .filter((c) => inWords(c.quote, text) && inWords(c.value, c.quote))
    .map((c) => c.value.trim())
    .filter((c) => normalise(c) !== normalise(title));
  const suggested = reading.suggestedComps.filter(
    (s) => normalise(s) !== normalise(title) && !comps.some((c) => normalise(c) === normalise(s)),
  );
  const all = (items: { value: string; quote: string }[]) =>
    unique(items.flatMap((i) => (inWords(i.quote, text) ? [i.value.trim()] : [])));
  // A name must be in its own quote, so the model cannot rename a person or a partner.
  const named = (items: { value: string; quote: string }[]) =>
    all(items.filter((i) => inWords(i.value, i.quote)));
  const budget =
    reading.budget && inWords(reading.budget.quote, text) ? reading.budget.quote : null;
  const scope = FULL_ASK.test(text) ? 'full' : reading.scope;
  return {
    format: kept(reading.format),
    genre: kept(reading.genre),
    comps: unique(comps),
    places: all(reading.places),
    window: kept(reading.window),
    ages: unique(reading.ages.flatMap((a) => (inWords(a.quote, text) ? [a.value] : []))),
    gender: kept(reading.gender),
    suggestedComps: comps.length >= 3 ? [] : unique(suggested),
    logline: kept(reading.logline),
    country: kept(reading.country),
    language: kept(reading.language),
    cast: named(reading.cast),
    director:
      reading.director && inWords(reading.director.value, reading.director.quote)
        ? kept(reading.director)
        : null,
    soundtrack: named(reading.soundtrack),
    route: kept(reading.route),
    budget: budget ? parseBudget(budget) : null,
    partners: named(reading.partners),
    scope,
    ask: scope === 'full' ? null : reading.ask,
  };
}

// Words that always mean a full plan, whatever the model read.
const FULL_ASK =
  /\b(launch plan|plan (?:the|our|my) launch|go[- ]to[- ]market|release plan|rollout plan|marketing plan)\b/i;

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 };

/** The amount a person wrote, such as "$50k" or "NGN 20 million". Null when there is no number. */
export function parseBudget(written: string): Budget | null {
  const m = written.match(
    /([$£€₦]|usd|gbp|eur|ngn|cad)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand)?\b/i,
  );
  if (!m?.[2]) return null;
  const amount = Number(m[2].replaceAll(',', '')) * (MULTIPLIER[m[3]?.toLowerCase() ?? ''] ?? 1);
  return amount > 0 ? { amount, currency: (m[1] ?? '').toUpperCase() } : null;
}

function unique<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = typeof v === 'string' ? normalise(v) : String(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const FILM_READ_SYSTEM = `You read a launch brief for a film or series and pull out what the person said, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- comps: films or series the person names as comparable, or says their audience also watches. The value is the title exactly as written. Never include the launch's own title.
- places: cities or territories the person names as markets for the launch.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). "18 to 34" is the first three bands. Quote their words.
- gender: only when they say the audience is mostly women or mostly men.
- genre and logline: the kind of film or series and what it is about, in their words.
- country: the country it comes from, as a full country name ("Nigeria", never "NG"). language: the language it is in.
- cast and director: names of people attached, exactly as written. soundtrack: artists already on the soundtrack.
- route: "theatrical" for cinemas, "streaming" for a platform release, "festival", or "hybrid" for both cinemas and a platform.
- budget: the marketing or release budget exactly as written, with its currency.
- partners: brands, media or organisations already signed as partners.
- scope: "full" when they ask for a launch plan, a go-to-market, or help with the launch in general, or when it is unclear. "narrow" only for one specific question, such as which cities, or who should do the soundtrack. This field is your judgment, with no quote.
- ask: for a narrow question, the part of a plan it is about: partnerships (music, brands, media partners), placement (trailer and ad placement), publicity (press, podcasts), community (grassroots, churches, campuses), route (release route and window), timeline, cadence (series release cadence), budget, measure (what to track), risks. Null when it is about cities or the audience, or when scope is full.
- suggestedComps: only when they named fewer than 3 comps. Propose well known, real films or series whose audience is likely the same, from the logline, genre, country and market, enough to reach 3 to 5 in all. Titles only, no years. Code checks each in Qloo.
- Plain words, no exclamation marks.`;

export class ModelFilmReader implements FilmReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ title, text }: FilmReaderInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: FILM_READ_SYSTEM,
      prompt: `Launch title: ${title}\n\nBrief:\n${text}`,
      output: Output.object({ schema: filmReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

/**
 * Reads only what is plainly written, for runs with no model key: quoted titles as comps, cities
 * in the city table, age ranges written as numbers, and an audience said to be women or men.
 */
export class ScriptedFilmReader implements FilmReader {
  async read({ title, text }: FilmReaderInput) {
    const quotes = [...text.matchAll(/["“]([^"”]{2,80})["”]/g)].flatMap(([, q]) => (q ? [q] : []));
    const lower = normalise(text);
    const places = cityNames().filter((city) =>
      new RegExp(`(^|[^\\p{L}])${escapeRegExp(normalise(city))}([^\\p{L}]|$)`, 'u').test(lower),
    );
    const ages = [...text.matchAll(/(\d{2})\s*(?:to|-|–)\s*(\d{2})/g)].flatMap((m) => {
      const [phrase, from, to] = m;
      return bandsBetween(Number(from), Number(to)).map((value) => ({ value, quote: phrase }));
    });
    const women = text.match(/\b(women|female)\b/i)?.[0];
    const men = text.match(/\b(men|male)\b/i)?.[0];
    const format = text.match(/\b(series|show)\b/i)?.[0] ?? text.match(/\b(film|movie)\b/i)?.[0];
    const genre = text.match(GENRES)?.[0];
    const demonym = text.match(new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b`, 'i'))?.[0];
    const logline = text.split(/(?<=[.!?])\s+/)[0]?.trim();
    const route = text.match(
      /\b(streaming|netflix|prime video|cinemas?|theatrical|festival)\b/i,
    )?.[0];
    const budget = text.match(
      /(?:[$£€₦]|\b(?:usd|gbp|eur|ngn)\s?)\d[\d,.]*\s?(?:k|m|million|thousand)?\b/i,
    )?.[0];
    const reading: FilmReading = {
      format: format
        ? { value: /series|show/i.test(format) ? 'series' : 'film', quote: format }
        : null,
      genre: genre ? { value: genre.toLowerCase(), quote: genre } : null,
      logline: logline && logline.length >= 20 ? { value: logline, quote: logline } : null,
      country: demonym
        ? { value: DEMONYMS[demonym.toLowerCase()] ?? demonym, quote: demonym }
        : null,
      language: null,
      cast: [],
      director: null,
      soundtrack: [],
      route: route ? { value: routeOf(route), quote: route } : null,
      budget: budget ? { value: budget, quote: budget } : null,
      partners: [],
      scope: 'full',
      ask: null,
      comps: quotes
        .filter((q) => normalise(q) !== normalise(title))
        .map((q) => ({ value: q, quote: q })),
      places: places.map((city) => ({ value: city, quote: city })),
      window: null,
      ages,
      gender: women
        ? { value: 'female', quote: women }
        : men
          ? { value: 'male', quote: men }
          : null,
      suggestedComps: [],
    };
    return { reading, tokens: 0 };
  }
}

const DEMONYMS: Record<string, string> = {
  nigerian: 'Nigeria',
  nollywood: 'Nigeria',
  ghanaian: 'Ghana',
  kenyan: 'Kenya',
  'south african': 'South Africa',
  korean: 'South Korea',
  jamaican: 'Jamaica',
  indian: 'India',
  mexican: 'Mexico',
  brazilian: 'Brazil',
};

const GENRES =
  /\b(crime|thriller|drama|comedy|horror|romance|romantic comedy|documentary|action|sci-fi|science fiction|fantasy|animation|musical|western|war|mystery)\b/i;

function routeOf(word: string): (typeof releaseRoutes)[number] {
  if (/streaming|netflix|prime/i.test(word)) return 'streaming';
  if (/festival/i.test(word)) return 'festival';
  return 'theatrical';
}

/** The Qloo age bands a written range such as 18 to 34 overlaps. */
export function bandsBetween(from: number, to: number): AgeBand[] {
  return ageBands.filter((band) => {
    const [low, high] = BAND_RANGES[band];
    return low <= to && high >= from;
  });
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackFilmReader implements FilmReader {
  constructor(
    private readonly primary: FilmReader,
    private readonly fallback: FilmReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: FilmReaderInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
