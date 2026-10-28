import { cityNames } from '@oraqul/engine';
import { gamesPlan } from '@oraqul/packs';
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
  namesIn,
  said,
} from '../launch/read-core.js';
import { normalise } from '../router/decide.js';
import { isRegionWord } from './regions.js';

export { type AgeBand, ageBands, type Budget, parseBudget } from '../launch/read-core.js';

const { GAMES_MODULES, REGION_CITIES, launchKinds, platforms, kindFrom } = gamesPlan;

/** What the model reads from the brief. Every value carries the person's own words. */
export const gamesReadingSchema = z.object({
  /** The game the launch is for, exactly as written. */
  game: said(z.string().min(1)).nullable(),
  /** `premium`, `early_access`, `free_to_play` or `mobile`, from what the person says it is. */
  launchKind: said(z.enum(launchKinds)).nullable(),
  /** Platforms the person names, such as "Steam" (pc) or "Switch". */
  platforms: z.array(said(z.enum(platforms))).max(7),
  /** Earlier games in the same series or by the same studio, as written. They are anchors. */
  franchise: z.array(said(z.string().min(1))).max(4),
  /** Music, series, anime, film, brand, podcast or game partners the person wants to collab with. */
  collabs: z.array(said(z.string().min(1))).max(6),
  /** Store tags the person has chosen or plans to use, as written. */
  storeTags: z.array(said(z.string().min(1))).max(10),
  /** Countries or regions the person names, as written ("Europe", "Brazil"). */
  regions: z.array(said(z.string().min(1))).max(8),
  /** Creators or streamers already signed, as written. */
  creators: z.array(said(z.string().min(1))).max(6),
  /**
   * The language, culture or community the game is built for, in the person's words ("Portuguese
   * speaking Brazilians"). Qloo cannot target it and never receives it: only the writer and the
   * web search do, for language, local practice and community.
   */
  audienceNote: said(z.string().min(1)).nullable(),
  /** The game's genre as a short name ("roguelike", "cozy sim"). */
  genre: said(z.string().min(1)).nullable(),
  /** The studio's country, as a full country name. */
  country: said(z.string().min(1)).nullable(),
  /** The marketing budget as written, such as "$50,000". Code reads the number. */
  budget: said(z.string().min(1)).nullable(),
  /** Partners already signed, as written. They are anchors, never suggested back. */
  partners: z.array(said(z.string().min(1))).max(6),
  /** `full` for a launch plan or an unclear ask, `narrow` for one question such as regions. */
  scope: z.enum(['full', 'narrow']),
  /** The module a narrow ask is about, or null when it is about the core (regions, audience). */
  ask: z.enum(GAMES_MODULES).nullable(),
  /** Comparable games the person named, exactly as written. */
  comps: z.array(said(z.string().min(1))).max(8),
  /** Cities the person names. */
  places: z.array(said(z.string().min(1))).max(12),
  window: said(z.string().min(1)).nullable(),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
});
export type GamesReading = z.infer<typeof gamesReadingSchema>;

/** The reading after code kept only what the person said. Stored in a paused run's state. */
export const gamesReadSchema = z.object({
  game: z.string().nullable(),
  /** Null when the brief does not say; the plan then assumes one and says so. */
  launchKind: z.enum(launchKinds).nullable(),
  /** Only the platforms the person named. */
  platforms: z.array(z.enum(platforms)),
  franchise: z.array(z.string()),
  collabs: z.array(z.string()),
  storeTags: z.array(z.string()),
  /** The region words as written, for the line check. Their cities are in `places`. */
  regions: z.array(z.string()),
  creators: z.array(z.string()),
  /** Language, culture or community, for the writer and the web search. Never sent to Qloo. */
  audienceNote: z.string().nullable().default(null),
  genre: z.string().nullable(),
  country: z.string().nullable(),
  budget: budgetSchema.nullable(),
  partners: z.array(z.string()),
  scope: z.enum(['full', 'narrow']),
  ask: z.enum(GAMES_MODULES).nullable(),
  comps: z.array(z.string()),
  /** Cities the person named. The cities a region word stands for are not here: they were not asked for. */
  places: z.array(z.string()),
  window: z.string().nullable(),
  ages: z.array(z.enum(ageBands)),
  gender: z.enum(['male', 'female']).nullable(),
  suggestedComps: z.array(z.string()),
});
export type GamesRead = z.infer<typeof gamesReadSchema> & LaunchRead;

export interface GamesReaderInput {
  title: string;
  /** The first message, the text of its files, and this run's message. */
  text: string;
}

export interface GamesReader {
  read(input: GamesReaderInput): Promise<{ reading: GamesReading; tokens: number }>;
}

const regionWord = isRegionWord;

/**
 * Keeps only values whose quote is in the person's words. A name must also appear in its own
 * quote, so a model cannot rename a game, a collab or a comp.
 */
export function checkReading(reading: GamesReading, input: GamesReaderInput): GamesRead {
  const common = checkCommon(reading, input);
  const { text } = input;
  const game =
    reading.game &&
    inWords(reading.game.quote, text) &&
    inWords(reading.game.value, reading.game.quote)
      ? reading.game.value.trim()
      : null;
  const isGame = (name: string) => game !== null && normalise(name) === normalise(game);
  const stated = reading.platforms.flatMap((p) => (inWords(p.quote, text) ? [p.value] : []));
  const named = [...new Set(stated)];
  const kind =
    reading.launchKind && inWords(reading.launchKind.quote, text)
      ? reading.launchKind.value
      : kindFrom(text, named);
  // The model may put a region in "places". A region is not a city, so it moves to regions.
  const cities = common.places.filter((p) => !regionWord(p));
  const regions = [
    ...new Set([...namesIn(reading.regions, text), ...common.places.filter(regionWord)]),
  ];
  const comps = common.comps.filter((c) => !isGame(c));
  return {
    ...common,
    // Comps are chosen from the description by the analyst, after this reading.
    suggestedComps: [],
    comps,
    // A narrow ask names a module this category offers, which the shared check cannot know.
    ask: common.scope === 'full' ? null : reading.ask,
    game,
    launchKind: kind,
    platforms: named,
    franchise: namedIn(reading.franchise, text).filter((f) => !isGame(f)),
    collabs: namedIn(reading.collabs, text).filter((c) => !isGame(c)),
    storeTags: namesIn(reading.storeTags, text),
    regions,
    creators: namedIn(reading.creators, text),
    audienceNote:
      reading.audienceNote && inWords(reading.audienceNote.quote, text)
        ? reading.audienceNote.value.trim().slice(0, 120)
        : null,
    places: cities,
  };
}

export const GAMES_READ_SYSTEM = `You read a launch brief for a video game and pull out what the person said, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- game: the game the launch is for, exactly as written. Never a comp.
- launchKind: "premium" for a paid PC or console release, "early_access" for a Steam Early Access (or similar) release, "free_to_play" for a free-to-play or live-service game, "mobile" for a phone game. Only when the person says so or plainly implies it; otherwise null.
- platforms: each platform they name: pc (Steam, Epic, Windows), playstation, xbox, switch (Nintendo), ios, android, vr.
- comps: comparable games the person names, or says their players also play. The value is the name exactly as written. Never include the game itself.
- franchise: earlier games in the same series, or by the same studio, that they name. Not a comp.
- collabs: partners they want to collaborate with from another medium: an artist or band, a series or anime, a film, a brand, a podcast, or another game. Exactly as written.
- storeTags: tags they have chosen or plan to use on the store page.
- places: cities they name. regions: countries or regions they name or build the game for ("Europe", "Brazil", "Southeast Asia"). A nationality counts: "built for Nigerians" gives the value "Nigeria" with "Nigerians" as the quote. Never an ethnic group or any personal detail: leave those out.
- creators: streamers or video creators already signed.
- audienceNote: the language, culture or community the game is built for, when they say so ("Portuguese speaking Brazilians", "college students in Manila", "the Korean diaspora"), in their words. It is context for the writer, never for Qloo, so keep it short and never add anything about an individual.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). "18 to 34" is the first three bands. Quote their words.
- gender: only when they say the players are mostly women or mostly men.
- genre: the game's genre as a short name in their words ("roguelike", "cozy sim", "souls-like").
- country: the studio's country, as a full country name.
- budget: the marketing budget exactly as written, with its currency.
- partners: brands, media or organisations already signed as partners.
- window: the release date or window as written ("Q3 2027", "October").
- scope: "full" when they ask for a launch plan, a go-to-market, or help with the launch in general, or when it is unclear. "narrow" only for one specific question, such as which regions, or which creators. This field is your judgment, with no quote.
- ask: for a narrow question, the part of a plan it is about: store (store page and tags), events (festivals, showcases), softlaunch, earlyaccess, collabs (fan base collabs), creators, liveops (seasons, events after launch), publicity (press, podcasts), partnerships (brands), community, timeline, budget, measure (what to track), risks. Null when it is about regions or the audience, or when scope is full.
- Plain words, no exclamation marks.`;

export class ModelGamesReader implements GamesReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ title, text }: GamesReaderInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: GAMES_READ_SYSTEM,
      prompt: `Launch title: ${title}\n\nBrief:\n${text}`,
      output: Output.object({ schema: gamesReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

// A nationality names where a game is built for, as well as a studio's country.
const NATIONS: Record<string, string> = {
  nigerian: 'Nigeria',
  ghanaian: 'Ghana',
  kenyan: 'Kenya',
  'south african': 'South Africa',
  brazilian: 'Brazil',
  indian: 'India',
  japanese: 'Japan',
  korean: 'South Korea',
  polish: 'Poland',
  swedish: 'Sweden',
  canadian: 'Canada',
  mexican: 'Mexico',
  indonesian: 'Indonesia',
  filipino: 'Philippines',
  egyptian: 'Egypt',
};

const DEMONYMS: Record<string, string> = {
  swedish: 'Sweden',
  polish: 'Poland',
  finnish: 'Finland',
  canadian: 'Canada',
  japanese: 'Japan',
  korean: 'South Korea',
  british: 'United Kingdom',
  american: 'United States',
  french: 'France',
  german: 'Germany',
  brazilian: 'Brazil',
  nigerian: 'Nigeria',
};

// A release window as people write it: a day, a month, or a quarter.
const WINDOW =
  /\b(?:\d{4}-\d{2}-\d{2}|(?:\d{1,2} )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?: \d{1,2},?)? \d{4}|q[1-4] \d{4})\b/i;

const GENRES =
  /\b(roguelike|roguelite|souls-?like|metroidvania|deck-?builder|rpg|jrpg|platformer|puzzle|cozy(?: sim)?|farming sim|simulation|survival|shoot\w*|fps|strategy|4x|tower defen[cs]e|horror|racing|fighting|sandbox|visual novel|rhythm)\b/i;

/**
 * Reads only what is plainly written, for runs with no model key. The game is a name in quotes
 * after the word game or title; every other quoted name is a comp, except one after a word like
 * collab. Cities come from the city table, regions from the region table.
 */
export class ScriptedGamesReader implements GamesReader {
  async read({ title, text }: GamesReaderInput) {
    const game = text.match(/\b(?:game|title)\s+["“]([^"”]{2,80})["”]/i)?.[1];
    const collabs = [
      ...text.matchAll(
        /\b(?:collab\w*|crossover|cross-promo\w*|tie-?in|team(?:ing)? up)(?: with)?\s+["“]([^"”]{2,80})["”]/gi,
      ),
    ].flatMap((m) => (m[1] ? [m[1]] : []));
    const franchise = [
      ...text.matchAll(
        /\b(?:sequel to|follow(?:s|-up to)|from the makers of)\s+["“]([^"”]{2,80})["”]/gi,
      ),
    ].flatMap((m) => (m[1] ? [m[1]] : []));
    const quotes = [...text.matchAll(/["“]([^"”]{2,80})["”]/g)]
      .flatMap(([, q]) => (q ? [q] : []))
      .filter((q) => q !== game && !collabs.includes(q) && !franchise.includes(q));
    const lower = normalise(text);
    const mentioned = (word: string) =>
      new RegExp(`(^|[^\\p{L}])${escapeRegExp(normalise(word))}([^\\p{L}]|$)`, 'u').test(lower);
    // In the order the person wrote them.
    const places = cityNames()
      .filter(mentioned)
      .sort((a, b) => lower.indexOf(normalise(a)) - lower.indexOf(normalise(b)));
    const nationality = text.match(
      new RegExp(`\\b(${Object.keys(NATIONS).join('|')})s?\\b`, 'i'),
    )?.[0];
    const regions = [...regionsIn(text)];
    const ages = [...text.matchAll(/(\d{2})\s*(?:to|-|–)\s*(\d{2})/g)].flatMap((m) => {
      const [phrase, from, to] = m;
      return bandsBetween(Number(from), Number(to)).map((value) => ({ value, quote: phrase }));
    });
    const women = text.match(/\b(women|female)\b/i)?.[0];
    const men = text.match(/\b(men|male)\b/i)?.[0];
    const genre = text.match(GENRES)?.[0];
    const demonym = text.match(new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b`, 'i'))?.[0];
    const budget = text.match(
      /(?:[$£€]|\b(?:usd|gbp|eur|cad)\s?)\d[\d,.]*\s?(?:k|m|million|thousand)?\b/i,
    )?.[0];
    const window = text.match(WINDOW)?.[0];
    const builtFor = text.match(
      /\b(?:built|made|designed|aimed|targeted)\s+(?:for|at)\s+([^.\n;]{3,100})/i,
    )?.[1];
    const tags = text.match(/\b(?:store )?tags?\s*[:-]\s*([^.\n]+)/i)?.[1];
    const named = gamesPlan.platformsFrom(text);
    const reading: GamesReading = {
      game: game ? { value: game, quote: game } : null,
      launchKind: null,
      platforms: named.map((value) => ({ value, quote: platformQuote(text, value) })),
      franchise: franchise.map((f) => ({ value: f, quote: f })),
      collabs: collabs.map((c) => ({ value: c, quote: c })),
      storeTags: (tags?.split(/,|;/) ?? [])
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 40)
        .map((t) => ({ value: t, quote: t })),
      regions: [
        ...regions.map((r) => ({ value: r, quote: r })),
        ...(nationality && NATIONS[nationality.toLowerCase().replace(/s$/, '')]
          ? [
              {
                value: NATIONS[nationality.toLowerCase().replace(/s$/, '')] as string,
                quote: nationality,
              },
            ]
          : []),
      ],
      creators: [],
      audienceNote: builtFor ? { value: builtFor.trim(), quote: builtFor.trim() } : null,
      genre: genre ? { value: genre.toLowerCase(), quote: genre } : null,
      country: demonym
        ? { value: DEMONYMS[demonym.toLowerCase()] ?? demonym, quote: demonym }
        : null,
      budget: budget ? { value: budget, quote: budget } : null,
      partners: [],
      scope: 'full',
      ask: null,
      comps: quotes
        .filter((q) => normalise(q) !== normalise(title))
        .map((q) => ({ value: q, quote: q })),
      places: places.map((city) => ({ value: city, quote: city })),
      window: window ? { value: window, quote: window } : null,
      ages,
      gender: women
        ? { value: 'female', quote: women }
        : men
          ? { value: 'male', quote: men }
          : null,
    };
    // The launch kind is read from the words in `checkReading`, so a run with a model and one
    // without agree on it.
    return { reading, tokens: 0 };
  }
}

/**
 * The region words in a text, as the person wrote them and in the order they wrote them. A word
 * inside a longer one ("Asia" in "Southeast Asia") is not a region of its own.
 */
export function regionsIn(text: string): string[] {
  const spans = Object.keys(REGION_CITIES).flatMap((key) =>
    [...text.matchAll(new RegExp(`(?<![\\p{L}])${escapeRegExp(key)}(?![\\p{L}])`, 'giu'))].map(
      (m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, written: m[0] }),
    ),
  );
  return spans
    .filter(
      (a) =>
        !spans.some(
          (b) =>
            b !== a && b.start <= a.start && b.end >= a.end && b.end - b.start > a.end - a.start,
        ),
    )
    .sort((a, b) => a.start - b.start)
    .map((s) => s.written);
}

/** The words in the text that name a platform, so the reading's quote is the person's own. */
function platformQuote(text: string, platform: gamesPlan.Platform): string {
  const hit = [
    ...text.matchAll(
      /\b(pc|steam|windows|epic games|gog|playstation|ps4|ps5|xbox|switch|nintendo|ios|iphone|ipad|app store|android|google play|vr|quest|psvr)\b/gi,
    ),
  ].find((m) => gamesPlan.platformsFrom(m[0]).includes(platform));
  return hit?.[0] ?? platform;
}

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackGamesReader implements GamesReader {
  constructor(
    private readonly primary: GamesReader,
    private readonly fallback: GamesReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: GamesReaderInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
