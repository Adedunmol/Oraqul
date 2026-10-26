import { cityNames } from '@oraqul/engine';
import type { LaunchResults } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { normalise } from '../router/decide.js';

const quote = z.string().min(1);

/** What the model reads about a launch that is out. Every value carries the person's own words. */
export const resultsReadingSchema = z.object({
  /** True when the plan or the message says the launch already happened. */
  launched: z.object({ value: z.boolean(), quote }).nullable(),
  measure: z.object({ value: z.string().min(1), quote }).nullable(),
  asOf: z.object({ value: z.string().min(1), quote }).nullable(),
  /** Where the figures come from, as the person wrote it. */
  source: z
    .object({ value: z.string().min(1), quote })
    .nullable()
    .optional(),
  byPlace: z.array(z.object({ place: z.string().min(1), value: z.number().min(0), quote })).max(30),
  byAge: z
    .array(z.object({ band: z.string().min(1), value: z.number().min(0), quote }))
    .max(8)
    .nullable(),
});
export type ResultsReading = z.infer<typeof resultsReadingSchema>;

/** The reading after code kept only what the person wrote. */
export interface ReadResults {
  launched: boolean;
  results: LaunchResults | null;
}

export interface ResultsReader {
  read(input: { text: string }): Promise<{ reading: ResultsReading; tokens: number }>;
}

function inWords(quoteText: string, text: string): boolean {
  const q = normalise(quoteText);
  return q !== '' && normalise(text).includes(q);
}

/** The digits of a number as people write it, so a model cannot change a figure. */
function digitsOf(n: number): string {
  return String(n);
}

function writesNumber(quoteText: string, value: number): boolean {
  const written = [...quoteText.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:k|m|million|thousand)?/gi)].map(
    (m) => parseFigure(m[0]),
  );
  return written.some((n) => n === value) || quoteText.includes(digitsOf(value));
}

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 };

/** A figure as written, such as "4,200", "35%" or "12k". */
export function parseFigure(written: string): number {
  const m = written.trim().match(/^(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
  if (!m?.[1]) return Number.NaN;
  return Number(m[1].replaceAll(',', '')) * (MULTIPLIER[m[2]?.toLowerCase() ?? ''] ?? 1);
}

/**
 * Keeps a place or an age band only when the person's own words contain its quote and the quote
 * writes its number, so the model can neither invent a result nor change one (hard rule 1).
 */
export function checkResults(reading: ResultsReading, text: string): ReadResults {
  const launched =
    reading.launched && inWords(reading.launched.quote, text) ? reading.launched.value : false;
  const seen = new Set<string>();
  const byPlace = reading.byPlace.flatMap((p) => {
    const key = normalise(p.place);
    if (seen.has(key) || !inWords(p.quote, text) || !inWords(p.place, p.quote)) return [];
    if (!writesNumber(p.quote, p.value)) return [];
    seen.add(key);
    return [{ place: p.place.trim(), value: p.value }];
  });
  const byAge = (reading.byAge ?? []).flatMap((a) =>
    inWords(a.quote, text) && writesNumber(a.quote, a.value)
      ? [{ band: a.band.trim(), value: a.value }]
      : [],
  );
  if (byPlace.length === 0) return { launched, results: null };
  return {
    launched: launched || byPlace.length > 0,
    results: {
      asOf: reading.asOf && inWords(reading.asOf.quote, text) ? reading.asOf.value : null,
      source: reading.source && inWords(reading.source.quote, text) ? reading.source.value : null,
      measure:
        reading.measure && inWords(reading.measure.quote, text) ? reading.measure.value : 'results',
      byPlace,
      byAge: byAge.length ? byAge : null,
    },
  };
}

export const RESULTS_READ_SYSTEM = `You read a launch plan, and any results the person added, for Oraqul. You pull out whether the launch is already out and what it produced, as aggregates only.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- launched: true only when they say the launch already happened (it opened, it came out, it flopped, sales were weak). A plan for something still to come is not launched.
- byPlace: one row per city or territory that has a result figure, with the number exactly as they wrote it (sales, streams, tickets, wishlists, downloads, views). The quote must contain the city and the number. Never add up, estimate or convert.
- byAge: one row per age group that has a figure, with the group as they wrote it.
- measure: what the numbers count, in their words ("tickets sold", "streams").
- asOf: the date or period the results cover, as written.
- source: where the figures come from, as written ("Instagram insights", "the box office report"). Leave it null when they do not say.
- Never include a person's name or any personal detail.`;

export class ModelResultsReader implements ResultsReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ text }: { text: string }) {
    const { output, usage } = await generateText({
      model: this.model,
      system: RESULTS_READ_SYSTEM,
      prompt: `Plan and results:\n${text}`,
      output: Output.object({ schema: resultsReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

const LAUNCHED =
  /\b(launched|released|opened|premiered|came out|went live|is out|has been out|flopped|underperformed|missed|sold (?:under|badly|poorly|only)|did(?:n't| not) (?:land|sell|perform))\b/i;
// “Not launched yet” says the launch is still to come, so a negated phrase is cut before reading.
const NOT_YET =
  /\b(?:not|never|no)\s+(?:yet\s+)?(?:been\s+)?(?:launched|released|opened|premiered|out|live)\b|\b(?:haven['’]t|hasn['’]t|isn['’]t|wasn['’]t|aren['’]t)\s+(?:yet\s+)?(?:been\s+)?(?:launched|released|opened|premiered|out|live)\b/gi;
const MEASURE =
  /\b(tickets?|streams?|downloads?|wishlists?|admissions|views|sales|box office|pre ?orders?|plays|listens)\b/i;
// An explicit label, such as “Source: Instagram insights”, so a source is never guessed.
const SOURCE = /\bsource\s*[:=]\s*([^\n;.]{2,60})/i;
const ROW =
  /^\s*[-*•]?\s*([\p{L}][\p{L} .'’-]{1,40}?)\s*[:=–-]\s*([\d][\d,]*(?:\.\d+)?)\s*(k|m|million|thousand)?\b/iu;
const AGE_ROW =
  /^\s*[-*•]?\s*((?:aged?\s*)?\d{2}\s*(?:to|-|–)\s*\d{2}|(?:under|over)\s*\d{2}|\d{2}\s*\+)\s*[:=–-]\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand|%)?/i;

/**
 * Reads only what is plainly written, for runs with no model key: lines like “Lagos: 4,200” for
 * cities in the city table, and “18 to 24: 40” for age groups.
 */
export class ScriptedResultsReader implements ResultsReader {
  async read({ text }: { text: string }) {
    const cities = new Set(cityNames().map(normalise));
    const lines = text.split(/\n|;/);
    const byPlace: ResultsReading['byPlace'] = [];
    const byAge: NonNullable<ResultsReading['byAge']> = [];
    for (const line of lines) {
      const age = line.match(AGE_ROW);
      if (age?.[1] && age[2]) {
        byAge.push({
          band: age[1].trim(),
          value: parseFigure(`${age[2]}${age[3] && age[3] !== '%' ? age[3] : ''}`),
          quote: line.trim(),
        });
        continue;
      }
      const row = line.match(ROW);
      if (row?.[1] && row[2] && cities.has(normalise(row[1]))) {
        byPlace.push({
          place: row[1].trim(),
          value: parseFigure(`${row[2]}${row[3] ?? ''}`),
          quote: line.trim(),
        });
      }
    }
    const measure = text.match(MEASURE)?.[0];
    const source = text.match(SOURCE)?.[1]?.trim();
    const launched = text.replace(NOT_YET, ' ').match(LAUNCHED)?.[0];
    const reading: ResultsReading = {
      launched: launched ? { value: true, quote: launched } : null,
      measure: measure ? { value: measure.toLowerCase(), quote: measure } : null,
      asOf: null,
      source: source ? { value: source, quote: source } : null,
      byPlace,
      byAge: byAge.length ? byAge : null,
    };
    return { reading, tokens: 0 };
  }
}

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackResultsReader implements ResultsReader {
  constructor(
    private readonly primary: ResultsReader,
    private readonly fallback: ResultsReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: { text: string }) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
