import { cityNames } from '@oraqul/engine';
import { musicPlan } from '@oraqul/packs';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
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

export const releaseTypes = ['single', 'ep', 'album', 'tour'] as const;
export type ReleaseType = (typeof releaseTypes)[number];

/** What the model reads from the brief. Every value carries the person's own words. */
export const musicReadingSchema = z.object({
  /** The artist or band the launch is for, exactly as written. */
  artist: said(z.string().min(1)).nullable(),
  releaseType: said(z.enum(releaseTypes)).nullable(),
  /** The sound, as a short genre name ("afrobeats", "drill", "indie pop"). */
  genre: said(z.string().min(1)).nullable(),
  /** The artist's country, as a full country name. */
  country: said(z.string().min(1)).nullable(),
  /** The marketing or release budget as written, such as "$50,000". Code reads the number. */
  budget: said(z.string().min(1)).nullable(),
  /** Partners already signed, as written. They are anchors, never suggested back. */
  partners: z.array(said(z.string().min(1))).max(6),
  /** Support acts already booked, as written. */
  supportActs: z.array(said(z.string().min(1))).max(6),
  /** Artists featured on the release or guesting on the tour, as written. Their fans are part of the audience. */
  featuredActs: z.array(said(z.string().min(1))).max(6),
  /** `full` for a launch plan or an unclear ask, `narrow` for one question such as cities. */
  scope: z.enum(['full', 'narrow']),
  /** The module a narrow ask is about, or null when it is about the core (cities, audience). */
  ask: z.enum(musicPlan.MUSIC_MODULES).nullable(),
  /** Sound-alike artists the person named, exactly as written. */
  comps: z.array(said(z.string().min(1))).max(8),
  places: z.array(said(z.string().min(1))).max(12),
  window: said(z.string().min(1)).nullable(),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
});
export type MusicReading = z.infer<typeof musicReadingSchema>;

/** The reading after code kept only what the person said. Stored in a paused run's state. */
export const musicReadSchema = z.object({
  artist: z.string().nullable(),
  releaseType: z.enum(releaseTypes).nullable(),
  genre: z.string().nullable(),
  country: z.string().nullable(),
  budget: budgetSchema.nullable(),
  partners: z.array(z.string()),
  supportActs: z.array(z.string()),
  featuredActs: z.array(z.string()),
  scope: z.enum(['full', 'narrow']),
  ask: z.enum(musicPlan.MUSIC_MODULES).nullable(),
  comps: z.array(z.string()),
  places: z.array(z.string()),
  window: z.string().nullable(),
  ages: z.array(z.enum(ageBands)),
  gender: z.enum(['male', 'female']).nullable(),
  suggestedComps: z.array(z.string()),
});
export type MusicRead = z.infer<typeof musicReadSchema> & LaunchRead;

export interface MusicReaderInput {
  title: string;
  /** The first message, the text of its files, and this run's message. */
  text: string;
}

export interface MusicReader {
  read(input: MusicReaderInput): Promise<{ reading: MusicReading; tokens: number }>;
}

/**
 * Keeps only values whose quote is in the person's words. A name must also appear in its own
 * quote, so a model cannot rename an artist, a partner or a comp.
 */
export function checkReading(reading: MusicReading, input: MusicReaderInput): MusicRead {
  const common = checkCommon(reading, input);
  const { text } = input;
  const artist =
    reading.artist &&
    inWords(reading.artist.quote, text) &&
    inWords(reading.artist.value, reading.artist.quote)
      ? reading.artist.value.trim()
      : null;
  const releaseType =
    reading.releaseType && inWords(reading.releaseType.quote, text)
      ? reading.releaseType.value
      : null;
  return {
    ...common,
    // The artist is never one of its own sound-alikes.
    comps: common.comps.filter((c) => !artist || normalise(c) !== normalise(artist)),
    // A narrow ask names a module this category offers, which the shared check cannot know.
    ask: common.scope === 'full' ? null : reading.ask,
    artist,
    releaseType,
    supportActs: namedIn(reading.supportActs, text),
    // The artist is never featured on their own record.
    featuredActs: namedIn(reading.featuredActs, text).filter(
      (f) => !artist || normalise(f) !== normalise(artist),
    ),
  };
}

export const MUSIC_READ_SYSTEM = `You read a launch brief for a music release or tour and pull out what the person said, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- artist: the artist or band the launch is for, exactly as written. Never a comp.
- releaseType: "single", "ep", "album" or "tour", for what is being launched. A tour in support of an album is "tour".
- comps: sound-alike artists the person names as comparable, or says their audience also plays. The value is the name exactly as written. Never include the artist themself.
- places: cities or territories the person names as markets or tour stops, in the order they write them.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). "18 to 34" is the first three bands. Quote their words.
- gender: only when they say the audience is mostly women or mostly men.
- genre: the sound, as a short genre name in their words ("afrobeats", "drill", "indie pop").
- country: the artist's country, as a full country name ("Nigeria", never "NG").
- budget: the marketing or release budget exactly as written, with its currency.
- partners: brands, media or organisations already signed as partners.
- supportActs: artists already booked to open or play alongside.
- featuredActs: artists featured on the release (a feature, a guest verse, a collaboration) or guesting on the tour. Exactly as written. Never the artist themself, and never a support act.
- scope: "full" when they ask for a launch plan, a go-to-market, or help with the launch in general, or when it is unclear. "narrow" only for one specific question, such as which cities, or who should support. This field is your judgment, with no quote.
- ask: for a narrow question, the part of a plan it is about: partnerships (brands, media partners), publicity (press, podcasts, playlists), community (campuses, grassroots), tour (the order of cities), support (support acts), sync (series and films), timeline, budget, measure (what to track), risks. Null when it is about cities or the audience, or when scope is full.
- Plain words, no exclamation marks.`;

export class ModelMusicReader implements MusicReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ title, text }: MusicReaderInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: MUSIC_READ_SYSTEM,
      prompt: `Launch title: ${title}\n\nBrief:\n${text}`,
      output: Output.object({ schema: musicReadingSchema }),
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
  korean: 'South Korea',
  jamaican: 'Jamaica',
  british: 'United Kingdom',
  american: 'United States',
  colombian: 'Colombia',
  brazilian: 'Brazil',
};

const GENRES =
  /\b(afrobeats?|afropop|afro-?fusion|amapiano|highlife|alt[eé]|hip[- ]?hop|rap|drill|r&b|rnb|pop|k-pop|rock|indie|electronic|house|dancehall|reggae|reggaeton|gospel|jazz|soul|country|latin)\b/i;

const RELEASE = /\b(tour|album|ep|single|mixtape)\b/i;

/**
 * Reads only what is plainly written, for runs with no model key. The artist is a name in quotes
 * after the word artist, singer, band, rapper or act; every other quoted name is a sound-alike.
 * Cities come from the city table, ages from ranges written as numbers.
 */
export class ScriptedMusicReader implements MusicReader {
  async read({ title, text }: MusicReaderInput) {
    const artist = text.match(
      /\b(?:artist|singer|band|rapper|musician|act|duo)\s+["“]([^"”]{2,80})["”]/i,
    )?.[1];
    const support = [
      ...text.matchAll(/\bsupport(?:ed)?(?: acts?)?(?: by| from)?\s+["“]([^"”]{2,80})["”]/gi),
    ].flatMap((m) => (m[1] ? [m[1]] : []));
    const featured = [
      ...text.matchAll(
        /\b(?:featuring|feat\.?|ft\.?|features|with a feature from)\s+["“]([^"”]{2,80})["”]/gi,
      ),
    ].flatMap((m) => (m[1] ? [m[1]] : []));
    const quotes = [...text.matchAll(/["“]([^"”]{2,80})["”]/g)]
      .flatMap(([, q]) => (q ? [q] : []))
      .filter((q) => q !== artist && !support.includes(q) && !featured.includes(q));
    const lower = normalise(text);
    // In the order the person wrote them: the tour order is theirs to set, and is tested.
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
    const release = text.match(RELEASE)?.[0];
    const demonym = text.match(new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b`, 'i'))?.[0];
    const budget = text.match(
      /(?:[$£€₦]|\b(?:usd|gbp|eur|ngn)\s?)\d[\d,.]*\s?(?:k|m|million|thousand)?\b/i,
    )?.[0];
    const reading: MusicReading = {
      artist: artist ? { value: artist, quote: artist } : null,
      releaseType: release ? { value: releaseOf(release), quote: release } : null,
      genre: genre ? { value: genre.toLowerCase(), quote: genre } : null,
      country: demonym
        ? { value: DEMONYMS[demonym.toLowerCase()] ?? demonym, quote: demonym }
        : null,
      budget: budget ? { value: budget, quote: budget } : null,
      partners: [],
      supportActs: support.map((s) => ({ value: s, quote: s })),
      featuredActs: featured.map((f) => ({ value: f, quote: f })),
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
    };
    return { reading, tokens: 0 };
  }
}

function releaseOf(word: string): ReleaseType {
  const w = word.toLowerCase();
  if (w === 'ep') return 'ep';
  if (w === 'single') return 'single';
  if (w === 'tour') return 'tour';
  return 'album';
}

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackMusicReader implements MusicReader {
  constructor(
    private readonly primary: MusicReader,
    private readonly fallback: MusicReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: MusicReaderInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
