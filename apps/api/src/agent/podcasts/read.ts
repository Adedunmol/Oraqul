import { cityNames } from '@oraqul/engine';
import { podcastsPlan } from '@oraqul/packs';
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

const { PODCASTS_MODULES, REGION_CITIES, launchKinds, formats, styles, platforms } = podcastsPlan;

/** What the model reads from the brief. Every value carries the person's own words. */
export const podcastsReadingSchema = z.object({
  /** The show the launch is for, exactly as written. */
  show: said(z.string().min(1)).nullable(),
  /** `debut` for a new show, `season` for a new season of a show that is out. */
  launchKind: said(z.enum(launchKinds)).nullable(),
  /** `audio`, `video` (filmed, on YouTube) or `both`. */
  format: said(z.enum(formats)).nullable(),
  /** How the show is made: interview, narrative, chat or news. */
  style: said(z.enum(styles)).nullable(),
  /** Where the show is published: apple, spotify, youtube. */
  platforms: z.array(said(z.enum(platforms))).max(3),
  /** Earlier shows by the same host or network that they name. They are anchors, never comps. */
  previousShows: z.array(said(z.string().min(1))).max(4),
  /** Shows they want to swap trailers or guests with. */
  crossPromo: z.array(said(z.string().min(1))).max(6),
  /** Rival shows they compete with, for the topic map. */
  rivals: z.array(said(z.string().min(1))).max(6),
  /** Topics they want the show to own. */
  topics: z.array(said(z.string().min(1))).max(8),
  /** The hosts, as written. */
  hosts: z.array(said(z.string().min(1))).max(4),
  /** Guests already booked or wanted, as written. */
  guests: z.array(said(z.string().min(1))).max(8),
  /** Countries or regions they name, as written ("Europe", "Nigeria"). */
  regions: z.array(said(z.string().min(1))).max(8),
  /**
   * The language, culture or community the show is made for, in the person's words. Qloo cannot
   * target it and never receives it: only the writer and the web search do.
   */
  audienceNote: said(z.string().min(1)).nullable(),
  /** The show's genre or subject as a short name ("true crime", "football"). */
  genre: said(z.string().min(1)).nullable(),
  /** The producer's country, as a full country name. */
  country: said(z.string().min(1)).nullable(),
  /** The marketing budget as written, such as "$20,000". Code reads the number. */
  budget: said(z.string().min(1)).nullable(),
  /** Sponsors or partners already signed, as written. They are anchors, never suggested back. */
  partners: z.array(said(z.string().min(1))).max(6),
  /** `full` for a launch plan or an unclear ask, `narrow` for one question such as markets. */
  scope: z.enum(['full', 'narrow']),
  /** The module a narrow ask is about, or null when it is about the core (markets, audience). */
  ask: z.enum(PODCASTS_MODULES).nullable(),
  /** Comparable shows the person named, exactly as written. */
  comps: z.array(said(z.string().min(1))).max(8),
  /** Cities the person names. */
  places: z.array(said(z.string().min(1))).max(12),
  window: said(z.string().min(1)).nullable(),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
});
export type PodcastsReading = z.infer<typeof podcastsReadingSchema>;

/** The reading after code kept only what the person said. Stored in a paused run's state. */
export const podcastsReadSchema = z.object({
  show: z.string().nullable(),
  /** Null when the brief does not say; the plan then assumes a new show and says so. */
  launchKind: z.enum(launchKinds).nullable(),
  /** Null when the brief does not say; the plan then assumes audio and says so. */
  format: z.enum(formats).nullable(),
  style: z.enum(styles).nullable(),
  /** Only the platforms the person named. */
  platforms: z.array(z.enum(platforms)),
  previousShows: z.array(z.string()),
  crossPromo: z.array(z.string()),
  rivals: z.array(z.string()),
  topics: z.array(z.string()),
  hosts: z.array(z.string()),
  guests: z.array(z.string()),
  /** The region words as written, for the line check. Their cities are in `places`. */
  regions: z.array(z.string()),
  /** Language, culture or community, for the writer and the web search. Never sent to Qloo. */
  audienceNote: z.string().nullable().default(null),
  genre: z.string().nullable(),
  country: z.string().nullable(),
  budget: budgetSchema.nullable(),
  partners: z.array(z.string()),
  scope: z.enum(['full', 'narrow']),
  ask: z.enum(PODCASTS_MODULES).nullable(),
  comps: z.array(z.string()),
  /** Cities the person named. The cities a region word stands for are not here: they were not asked for. */
  places: z.array(z.string()),
  window: z.string().nullable(),
  ages: z.array(z.enum(ageBands)),
  gender: z.enum(['male', 'female']).nullable(),
  suggestedComps: z.array(z.string()),
});
export type PodcastsRead = z.infer<typeof podcastsReadSchema> & LaunchRead;

export interface PodcastsReaderInput {
  title: string;
  /** The first message, the text of its files, and this run's message. */
  text: string;
}

export interface PodcastsReader {
  read(input: PodcastsReaderInput): Promise<{ reading: PodcastsReading; tokens: number }>;
}

/**
 * Keeps only values whose quote is in the person's words. A name must also appear in its own
 * quote, so a model cannot rename a show, a guest or a comp.
 */
export function checkReading(reading: PodcastsReading, input: PodcastsReaderInput): PodcastsRead {
  const common = checkCommon(reading, input);
  const { text } = input;
  const show =
    reading.show &&
    inWords(reading.show.quote, text) &&
    inWords(reading.show.value, reading.show.quote)
      ? reading.show.value.trim()
      : null;
  const isShow = (name: string) => show !== null && normalise(name) === normalise(show);
  const stated = reading.platforms.flatMap((p) => (inWords(p.quote, text) ? [p.value] : []));
  const named = [...new Set(stated)];
  const kind =
    reading.launchKind && inWords(reading.launchKind.quote, text)
      ? reading.launchKind.value
      : podcastsPlan.kindFrom(text);
  const format =
    reading.format && inWords(reading.format.quote, text)
      ? reading.format.value
      : podcastsPlan.formatFrom(text, named);
  const style =
    reading.style && inWords(reading.style.quote, text)
      ? reading.style.value
      : podcastsPlan.styleFrom(text);
  // The model may put a region in "places". A region is not a city, so it moves to regions.
  const cities = common.places.filter((p) => !isRegionWord(p));
  const regions = [
    ...new Set([...namesIn(reading.regions, text), ...common.places.filter(isRegionWord)]),
  ];
  const comps = common.comps.filter((c) => !isShow(c));
  // A show the team named as a swap or a rival is theirs already, so it is never added as a comp.
  const taken = [
    ...namedIn(reading.crossPromo, text),
    ...namedIn(reading.rivals, text),
    ...namedIn(reading.previousShows, text),
  ];
  return {
    ...common,
    // Comps are chosen from the description by the analyst, after this reading.
    suggestedComps: [],
    comps,
    // A narrow ask names a module this category offers, which the shared check cannot know.
    ask: common.scope === 'full' ? null : reading.ask,
    show,
    launchKind: kind,
    format,
    style,
    platforms: named,
    previousShows: namedIn(reading.previousShows, text).filter((s) => !isShow(s)),
    crossPromo: namedIn(reading.crossPromo, text).filter((s) => !isShow(s)),
    rivals: namedIn(reading.rivals, text).filter((s) => !isShow(s)),
    topics: namesIn(reading.topics, text),
    hosts: namedIn(reading.hosts, text),
    guests: namedIn(reading.guests, text),
    regions,
    audienceNote:
      reading.audienceNote && inWords(reading.audienceNote.quote, text)
        ? reading.audienceNote.value.trim().slice(0, 120)
        : null,
    places: cities,
  };
}

export const PODCASTS_READ_SYSTEM = `You read a launch brief for a podcast and pull out what the person said, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- show: the podcast the launch is for, exactly as written. Never a comp.
- launchKind: "debut" for a brand new show, "season" for a new season of a show that is already out. Only when the person says so or plainly implies it; otherwise null.
- format: "audio", "video" (a filmed show, or one on YouTube) or "both". Only when they say so; otherwise null.
- style: "interview", "narrative" (storytelling, investigations, scripted), "chat" (co-hosts, banter, comedy) or "news". Only when they say so or plainly imply it.
- platforms: each place they publish: apple (Apple Podcasts), spotify, youtube.
- comps: comparable shows the person names, or says their listeners also hear. The value is the name exactly as written. Never include the show itself.
- previousShows: earlier shows by the same host or network that they name. Not a comp.
- crossPromo: shows they want to swap trailers, ads or guests with. Exactly as written.
- rivals: shows they say they compete with or want to beat.
- topics: subjects they want the show to be known for.
- hosts and guests: people they name as hosting, or as booked or wanted as guests. Exactly as written.
- places: cities they name. regions: countries or regions they name or make the show for ("Europe", "Nigeria", "West Africa"). A nationality counts: "for Nigerians" gives the value "Nigeria" with "Nigerians" as the quote. Never an ethnic group or any personal detail: leave those out.
- audienceNote: the language, culture or community the show is made for, when they say so ("Yoruba speakers", "the Nigerian diaspora"), in their words. It is context for the writer, never for Qloo, so keep it short and never add anything about an individual.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). "18 to 34" is the first three bands. Quote their words.
- gender: only when they say the listeners are mostly women or mostly men.
- genre: the show's subject as a short name in their words ("true crime", "football", "business").
- country: the producer's country, as a full country name.
- budget: the marketing budget exactly as written, with its currency.
- partners: sponsors, brands, media or organisations already signed as partners.
- window: the release date or window as written ("Q3 2027", "October").
- scope: "full" when they ask for a launch plan, a go-to-market, or help with the launch in general, or when it is unclear. "narrow" only for one specific question, such as which markets, or which shows to swap with. This field is your judgment, with no quote.
- ask: for a narrow question, the part of a plan it is about: crosspromo (shows to swap with), guests, partnerships (sponsors), publicity (press, newsletters), video (video and clips), live (live shows), community, cadence (episode schedule), timeline, budget, measure (what to track), risks. Null when it is about markets or the audience, or when scope is full.
- Plain words, no exclamation marks.`;

export class ModelPodcastsReader implements PodcastsReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ title, text }: PodcastsReaderInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: PODCASTS_READ_SYSTEM,
      prompt: `Launch title: ${title}\n\nBrief:\n${text}`,
      output: Output.object({ schema: podcastsReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

// A nationality names who a show is made for, as well as a producer's country.
const NATIONS: Record<string, string> = {
  nigerian: 'Nigeria',
  ghanaian: 'Ghana',
  kenyan: 'Kenya',
  'south african': 'South Africa',
  brazilian: 'Brazil',
  indian: 'India',
  british: 'United Kingdom',
  canadian: 'Canada',
  mexican: 'Mexico',
  egyptian: 'Egypt',
};

const DEMONYMS: Record<string, string> = {
  british: 'United Kingdom',
  american: 'United States',
  canadian: 'Canada',
  nigerian: 'Nigeria',
  ghanaian: 'Ghana',
  kenyan: 'Kenya',
  australian: 'Australia',
};

// A release window as people write it: a day, a month, or a quarter.
const WINDOW =
  /\b(?:\d{4}-\d{2}-\d{2}|(?:\d{1,2} )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?: \d{1,2},?)? \d{4}|q[1-4] \d{4})\b/i;

const QUOTED = '["“]([^"”]{2,80})["”]';

const namesAfter = (text: string, lead: string): string[] =>
  [...text.matchAll(new RegExp(`\\b(?:${lead})(?: with| on)?\\s+${QUOTED}`, 'gi'))].flatMap((m) =>
    m[1] ? [m[1]] : [],
  );

const PERSON = "[A-Z][\\p{L}'’-]+(?: [A-Z][\\p{L}'’-]+)+";

/**
 * Reads only what is plainly written, for runs with no model key. The show is a name in quotes
 * after the word podcast or show; every other quoted name is a comp, except one after a word like
 * swap or rival. Cities come from the city table, regions from the region table.
 */
export class ScriptedPodcastsReader implements PodcastsReader {
  async read({ title, text }: PodcastsReaderInput) {
    const show = text.match(new RegExp(`\\b(?:podcast|show|series)\\s+${QUOTED}`, 'i'))?.[1];
    const crossPromo = namesAfter(text, 'swap\\w*|cross-?promo\\w*|trailer swap|guest spot');
    const rivals = namesAfter(text, 'rival\\w*|compet\\w+|against|beat');
    const previousShows = namesAfter(text, 'from the makers of|by the team behind|spin-?off of');
    const hosts = [...text.matchAll(new RegExp(`\\bhosted by\\s+(${PERSON})`, 'gu'))].flatMap(
      (m) => (m[1] ? [m[1]] : []),
    );
    const guests = [
      ...text.matchAll(new RegExp(`\\bguests?(?: like| such as|:)\\s+(${PERSON})`, 'gu')),
    ].flatMap((m) => (m[1] ? [m[1]] : []));
    const topics = (
      text.match(/\b(?:own|owning|known for|topics?)\s*[:-]?\s*([^.\n;]{3,100})/i)?.[1] ?? ''
    )
      .split(/,| and /)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && t.length <= 40);
    const quotes = [...text.matchAll(new RegExp(QUOTED, 'g'))]
      .flatMap(([, q]) => (q ? [q] : []))
      .filter((q) => q !== show && ![...crossPromo, ...rivals, ...previousShows].includes(q));
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
    const genre = text.match(
      /\b(true[- ]crime|comedy|news|business|football|soccer|sports?|tech(?:nology)?|health|wellness|music|horror|history|documentary|politics|finance)\b/i,
    )?.[0];
    const demonym = text.match(new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b`, 'i'))?.[0];
    const budget = text.match(
      /(?:[$£€]|\b(?:usd|gbp|eur|cad)\s?)\d[\d,.]*\s?(?:k|m|million|thousand)?\b/i,
    )?.[0];
    const window = text.match(WINDOW)?.[0];
    const builtFor = text.match(
      /\b(?:made|built|designed|aimed|targeted)\s+(?:for|at)\s+([^.\n;,]{3,100})/i,
    )?.[1];
    const named = podcastsPlan.platformsFrom(text);
    const reading: PodcastsReading = {
      show: show ? { value: show, quote: show } : null,
      // Kind, format and style are read from the words in `checkReading`, so a run with a model
      // and one without agree on them.
      launchKind: null,
      format: null,
      style: null,
      platforms: named.map((value) => ({ value, quote: platformQuote(text, value) })),
      previousShows: previousShows.map((s) => ({ value: s, quote: s })),
      crossPromo: crossPromo.map((s) => ({ value: s, quote: s })),
      rivals: rivals.map((s) => ({ value: s, quote: s })),
      topics: topics.map((t) => ({ value: t, quote: t })),
      hosts: hosts.map((h) => ({ value: h, quote: h })),
      guests: guests.map((g) => ({ value: g, quote: g })),
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
    return { reading, tokens: 0 };
  }
}

/**
 * The region words in a text, as the person wrote them and in the order they wrote them. A word
 * inside a longer one ("Africa" in "West Africa") is not a region of its own.
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
function platformQuote(text: string, platform: podcastsPlan.Platform): string {
  const hit = [...text.matchAll(/\b(apple podcasts?|itunes|spotify|youtube|yt)\b/gi)].find((m) =>
    podcastsPlan.platformsFrom(m[0]).includes(platform),
  );
  return hit?.[0] ?? platform;
}

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackPodcastsReader implements PodcastsReader {
  constructor(
    private readonly primary: PodcastsReader,
    private readonly fallback: PodcastsReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: PodcastsReaderInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
