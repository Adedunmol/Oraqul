import type { LaunchModuleKey } from '@oraqul/schema';
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

export const quote = z.string().min(1);
/** A value the model read, with the person's own words it came from. */
export const said = <T extends z.ZodType>(value: T) => z.object({ value, quote });

export const budgetSchema = z.object({
  /** In the currency's main unit. */
  amount: z.number().positive(),
  /** A symbol or code as written, such as `$` or `NGN`. Empty when none was written. */
  currency: z.string(),
});
export type Budget = z.infer<typeof budgetSchema>;

/**
 * What every category's reading holds once code kept only what the person said. The shared
 * pipeline reads only these fields; a category adds its own (a film's cast, a music release type).
 */
export interface LaunchRead {
  genre: string | null;
  country: string | null;
  places: string[];
  comps: string[];
  suggestedComps: string[];
  ages: AgeBand[];
  gender: 'male' | 'female' | null;
  window: string | null;
  budget: Budget | null;
  /** Partners already signed, as written. They are anchors, never suggested back. */
  partners: string[];
  /** `full` for a launch plan or an unclear ask, `narrow` for one question such as cities. */
  scope: 'full' | 'narrow';
  /** The module a narrow ask is about, or null when it is about the core (cities, audience). */
  ask: LaunchModuleKey | null;
}

export function inWords(quoteText: string, text: string): boolean {
  const q = normalise(quoteText);
  return q !== '' && normalise(text).includes(q);
}

export function unique<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = typeof v === 'string' ? normalise(v) : String(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Words that always mean a full plan, whatever the model read.
export const FULL_ASK =
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

/**
 * The checked values every category's reading shares, from what the model read. A value counts
 * only when its quote is in the person's words; a comp must also appear in its own quote, and the
 * launch's own title is never a comp.
 */
export interface CommonReading {
  genre: { value: string; quote: string } | null;
  country: { value: string; quote: string } | null;
  budget: { value: string; quote: string } | null;
  scope: 'full' | 'narrow';
  ask: LaunchModuleKey | null;
  comps: { value: string; quote: string }[];
  places: { value: string; quote: string }[];
  window: { value: string; quote: string } | null;
  ages: { value: AgeBand; quote: string }[];
  gender: { value: 'male' | 'female'; quote: string } | null;
  partners: { value: string; quote: string }[];
  suggestedComps: string[];
}

export function checkCommon(
  reading: CommonReading,
  { title, text }: { title: string; text: string },
): LaunchRead {
  const kept = <T>(item: { value: T; quote: string } | null): T | null =>
    item && inWords(item.quote, text) ? item.value : null;
  const comps = reading.comps
    .filter((c) => inWords(c.quote, text) && inWords(c.value, c.quote))
    .map((c) => c.value.trim())
    .filter((c) => normalise(c) !== normalise(title));
  const suggested = reading.suggestedComps.filter(
    (s) => normalise(s) !== normalise(title) && !comps.some((c) => normalise(c) === normalise(s)),
  );
  const budget =
    reading.budget && inWords(reading.budget.quote, text) ? reading.budget.quote : null;
  const scope = FULL_ASK.test(text) ? 'full' : reading.scope;
  return {
    genre: kept(reading.genre),
    comps: unique(comps),
    places: namesIn(reading.places, text),
    window: kept(reading.window),
    ages: unique(reading.ages.flatMap((a) => (inWords(a.quote, text) ? [a.value] : []))),
    gender: kept(reading.gender),
    suggestedComps: comps.length >= 3 ? [] : unique(suggested),
    country: kept(reading.country),
    budget: budget ? parseBudget(budget) : null,
    partners: namedIn(reading.partners, text),
    scope,
    ask: scope === 'full' ? null : reading.ask,
  };
}

/** Values whose quote is in the person's words. */
export function namesIn(items: { value: string; quote: string }[], text: string): string[] {
  return unique(items.flatMap((i) => (inWords(i.quote, text) ? [i.value.trim()] : [])));
}

/** A name must be in its own quote, so the model cannot rename a person or a partner. */
export function namedIn(items: { value: string; quote: string }[], text: string): string[] {
  return namesIn(
    items.filter((i) => inWords(i.value, i.quote)),
    text,
  );
}
