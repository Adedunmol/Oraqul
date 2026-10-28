import { cityNames } from '@oraqul/engine';
import { showsPlan } from '@oraqul/packs';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { rivalsFrom } from '../launch/clash.js';
import {
  ageBands,
  bandsBetween,
  budgetSchema,
  checkCommon,
  escapeRegExp,
  inWords,
  type LaunchRead,
  namedIn,
  said,
} from '../launch/read-core.js';
import { normalise } from '../router/decide.js';

export { type AgeBand, ageBands, type Budget, parseBudget } from '../launch/read-core.js';

const { showTypes, showTypeFrom, showTypeMatch } = showsPlan;

/** What the model reads from the brief. Every value carries the person's own words. */
export const showsReadingSchema = z.object({
  /** The act the show is for: an artist, a comedian, a company or the title of a play. */
  act: said(z.string().min(1)).nullable(),
  showType: said(z.enum(showTypes)).nullable(),
  /** The sound or the kind of act, as a short genre name ("afrobeats", "stand-up"). */
  genre: said(z.string().min(1)).nullable(),
  /** The act's country, as a full country name. */
  country: said(z.string().min(1)).nullable(),
  /** The marketing budget as written, such as "$5,000". Code reads the number. */
  budget: said(z.string().min(1)).nullable(),
  /** Venue capacity in seats or tickets, as written. Never guessed. */
  capacity: said(z.number().int().positive()).nullable(),
  /** The ticket price band as written, such as "under $20". Never guessed. */
  priceBand: said(z.string().min(1)).nullable(),
  /** Weeks before the show that general on sale opens, when the team gave it. */
  onSaleWeeks: said(z.number().int().positive()).nullable(),
  partners: z.array(said(z.string().min(1))).max(6),
  /** Acts already booked to open, as written. */
  supportActs: z.array(said(z.string().min(1))).max(6),
  scope: z.enum(['full', 'narrow']),
  ask: z.enum(showsPlan.SHOWS_MODULES).nullable(),
  /** Comparable acts the person named, exactly as written. */
  comps: z.array(said(z.string().min(1))).max(8),
  places: z.array(said(z.string().min(1))).max(12),
  /** The show date, as written. */
  window: said(z.string().min(1)).nullable(),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
  /** Comparable acts the agent proposes when the person named fewer than 3. Code checks each. */
});
export type ShowsReading = z.infer<typeof showsReadingSchema>;

/** The reading after code kept only what the person said. Stored in a paused run's state. */
export const showsReadSchema = z.object({
  act: z.string().nullable(),
  showType: z.enum(showTypes).nullable(),
  genre: z.string().nullable(),
  country: z.string().nullable(),
  budget: budgetSchema.nullable(),
  capacity: z.number().int().positive().nullable(),
  priceBand: z.string().nullable(),
  onSaleWeeks: z.number().int().positive().nullable(),
  partners: z.array(z.string()),
  supportActs: z.array(z.string()),
  /** Rival shows the brief names with a day, read by form (`Rivals: Title on YYYY-MM-DD`). */
  rivalDates: z.array(z.object({ title: z.string(), date: z.string() })),
  scope: z.enum(['full', 'narrow']),
  ask: z.enum(showsPlan.SHOWS_MODULES).nullable(),
  comps: z.array(z.string()),
  places: z.array(z.string()),
  window: z.string().nullable(),
  ages: z.array(z.enum(ageBands)),
  gender: z.enum(['male', 'female']).nullable(),
  suggestedComps: z.array(z.string()),
});
export type ShowsRead = z.infer<typeof showsReadSchema> & LaunchRead;

export interface ShowsReaderInput {
  title: string;
  /** The first message, the text of its files, and this run's message. */
  text: string;
}

export interface ShowsReader {
  read(input: ShowsReaderInput): Promise<{ reading: ShowsReading; tokens: number }>;
}

const num = (text: string): number | null => {
  const n = Number(text.replaceAll(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/**
 * The fields the Guide writes as labelled lines, read by form so no model has to guess them:
 * "Venue capacity: 500.", "Ticket price band: £20 to £40.", "On sale: 6 weeks before the show.",
 * "Show type: comedy night.". Whatever the person wrote is kept as they wrote it.
 */
export function labelled(text: string): {
  capacity: number | null;
  priceBand: string | null;
  onSaleWeeks: number | null;
  showType: (typeof showTypes)[number] | null;
  quotes: {
    capacity: string | null;
    priceBand: string | null;
    onSaleWeeks: string | null;
    showType: string | null;
  };
} {
  const grab = (re: RegExp): string | null => text.match(re)?.[0]?.trim() ?? null;
  const cap = grab(/\b(?:venue )?capacity(?: of)?\s*:?\s*[\d,]+\b/i);
  const price = grab(/\bticket price(?: band)?\s*:\s*[^\n.]+/i);
  const weeks = grab(/\bon[- ]sale(?: window)?\s*:?\s*(?:about |around )?\d+\s*weeks?\b/i);
  const kind = grab(/\bshow type\s*:\s*[^\n.]+/i);
  return {
    capacity: cap ? num(cap.replace(/^\D+/, '')) : null,
    priceBand: price ? price.replace(/^[^:]*:\s*/, '').trim() : null,
    onSaleWeeks: weeks ? num(weeks.replace(/^\D+?(?=\d)/, '').replace(/\D+$/, '')) : null,
    showType: kind ? showTypeFrom(kind.replace(/^[^:]*:\s*/, '')) : null,
    quotes: { capacity: cap, priceBand: price, onSaleWeeks: weeks, showType: kind },
  };
}

/**
 * Keeps only values whose quote is in the person's words. A name must also appear in its own
 * quote, so a model cannot rename an act, a partner or a comp. The labelled lines the Guide
 * writes fill what the model left empty.
 */
export function checkReading(reading: ShowsReading, input: ShowsReaderInput): ShowsRead {
  const common = checkCommon(reading, input);
  const { text } = input;
  const lines = labelled(text);
  const act =
    reading.act && inWords(reading.act.quote, text) && inWords(reading.act.value, reading.act.quote)
      ? reading.act.value.trim()
      : null;
  const stated = <T>(r: { value: T; quote: string } | null): T | null =>
    r && inWords(r.quote, text) ? r.value : null;
  return {
    ...common,
    comps: common.comps.filter((c) => !act || normalise(c) !== normalise(act)),
    ask: common.scope === 'full' ? null : reading.ask,
    act,
    showType: stated(reading.showType) ?? lines.showType,
    capacity: stated(reading.capacity) ?? lines.capacity,
    priceBand:
      (reading.priceBand && inWords(reading.priceBand.quote, text)
        ? reading.priceBand.value.trim()
        : null) ?? lines.priceBand,
    onSaleWeeks: stated(reading.onSaleWeeks) ?? lines.onSaleWeeks,
    supportActs: namedIn(reading.supportActs, text),
    rivalDates: rivalsFrom(text),
  };
}

export const SHOWS_READ_SYSTEM = `You read a launch brief for a single live show or a short run, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- act: the artist, comedian, company or play the show is for, exactly as written. Never a comp.
- showType: "concert", "comedy", "club", "theatre" or "screening", for what is being staged.
- capacity: the venue capacity as a number, only when the person gave one. Never estimate it.
- priceBand: the ticket price band exactly as written, only when the person gave one. Never invent a price.
- onSaleWeeks: how many weeks before the show general on sale opens, only when the person gave it.
- window: the show date, as written.
- comps: comparable acts the person names, or says their audience also follows. Never the act itself.
- places: cities the person names, in the order they write them.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). Quote their words.
- gender: only when they say the audience is mostly women or mostly men.
- genre: the sound or kind of act, in their words.
- country: the act's country, as a full country name ("Nigeria", never "NG").
- budget: the marketing budget exactly as written, with its currency.
- partners: brands, media or organisations already signed as partners.
- supportActs: acts already booked to open.
- scope: "full" when they ask for a launch plan or help with the show in general, or when it is unclear. "narrow" only for one specific question. This field is your judgment, with no quote.
- ask: for a narrow question, the part of a plan it is about: onsale, partnerships, publicity, venues, finalpush, timeline, budget, measure, risks. Null when it is about cities or the audience, or when scope is full.
- Plain words, no exclamation marks.`;

export class ModelShowsReader implements ShowsReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ title, text }: ShowsReaderInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: SHOWS_READ_SYSTEM,
      prompt: `Show title: ${title}\n\nBrief:\n${text}`,
      output: Output.object({ schema: showsReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

const DEMONYMS: Record<string, string> = {
  nigerian: 'Nigeria',
  ghanaian: 'Ghana',
  kenyan: 'Kenya',
  'south african': 'South Africa',
  jamaican: 'Jamaica',
  british: 'United Kingdom',
  american: 'United States',
};

const GENRES =
  /\b(afrobeats?|afropop|amapiano|highlife|hip[- ]?hop|rap|drill|r&b|rnb|pop|rock|indie|electronic|house|dancehall|reggae|gospel|jazz|soul|stand-?up|improv)\b/i;

/**
 * Reads only what is plainly written, for runs with no model key. The act is a name in quotes
 * after the word artist, comedian, band, act or duo; every other quoted name is a comp. Cities
 * come from the city table, ages from ranges written as numbers, the rest from labelled lines.
 */
export class ScriptedShowsReader implements ShowsReader {
  async read({ title, text }: ShowsReaderInput) {
    const act = text.match(
      /\b(?:artist|singer|band|rapper|musician|act|duo|comedian|comic|company)\s+["“]([^"”]{2,80})["”]/i,
    )?.[1];
    const support = [
      ...text.matchAll(/\bsupport(?:ed)?(?: acts?)?(?: by| from)?\s+["“]([^"”]{2,80})["”]/gi),
    ].flatMap((m) => (m[1] ? [m[1]] : []));
    const quotes = [...text.matchAll(/["“]([^"”]{2,80})["”]/g)]
      .flatMap(([, q]) => (q ? [q] : []))
      .filter((q) => q !== act && !support.includes(q));
    const lower = normalise(text);
    const places = cityNames()
      .filter((city) =>
        new RegExp(`(^|[^\\p{L}])${escapeRegExp(normalise(city))}([^\\p{L}]|$)`, 'u').test(lower),
      )
      .sort((a, b) => lower.indexOf(normalise(a)) - lower.indexOf(normalise(b)));
    const ages = [...text.matchAll(/(\d{2})\s*(?:to|-|–)\s*(\d{2})/g)].flatMap((m) => {
      const [phrase, from, to] = m;
      return bandsBetween(Number(from), Number(to)).map((value) => ({ value, quote: phrase }));
    });
    const women = text.match(/\b(women|female)\b/i)?.[0];
    const men = text.match(/\b(men|male)\b/i)?.[0];
    const genre = text.match(GENRES)?.[0];
    const demonym = text.match(new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b`, 'i'))?.[0];
    const budget = text.match(
      /(?:[$£€₦]|\b(?:usd|gbp|eur|ngn)\s?)\d[\d,.]*\s?(?:k|m|million|thousand)?\b/i,
    )?.[0];
    const type = showTypeMatch(text);
    // The show's own date, not a rival's: the lines that name rivals are left out.
    const date = text
      .split('\n')
      .filter((l) => !/^[ \t>*-]*rivals?\b/i.test(l))
      .join('\n')
      .match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    const reading: ShowsReading = {
      act: act ? { value: act, quote: act } : null,
      showType: null,
      genre: genre ? { value: genre.toLowerCase(), quote: genre } : null,
      country: demonym
        ? { value: DEMONYMS[demonym.toLowerCase()] ?? demonym, quote: demonym }
        : null,
      budget: budget ? { value: budget, quote: budget } : null,
      capacity: null,
      priceBand: null,
      onSaleWeeks: null,
      partners: [],
      supportActs: support.map((s) => ({ value: s, quote: s })),
      scope: 'full',
      ask: null,
      comps: quotes
        .filter((q) => normalise(q) !== normalise(title))
        .map((q) => ({ value: q, quote: q })),
      places: places.map((city) => ({ value: city, quote: city })),
      // A show date written as a day is plainly the show's, so it is kept.
      window: date ? { value: date, quote: date } : null,
      ages,
      gender: women
        ? { value: 'female', quote: women }
        : men
          ? { value: 'male', quote: men }
          : null,
    };
    // The kind of show comes from the labelled line or a plain word, in `checkReading`.
    if (type) reading.showType = { value: type.type, quote: type.word };
    return { reading, tokens: 0 };
  }
}

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackShowsReader implements ShowsReader {
  constructor(
    private readonly primary: ShowsReader,
    private readonly fallback: ShowsReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: ShowsReaderInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
