import { cityNames, normalizeTitle } from '@oraqul/engine';
import { booksPlan } from '@oraqul/packs';
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

const { BOOKS_MODULES, REGION_CITIES, launchKinds, routes, readerships, formats, fallbackComps } =
  booksPlan;

/** What the model reads from the brief. Every value carries the person's own words. */
export const booksReadingSchema = z.object({
  /** The book the launch is for, exactly as written. */
  book: said(z.string().min(1)).nullable(),
  /** The author, as written. Never a signal: Qloo rejects a person as one. */
  author: said(z.string().min(1)).nullable(),
  /** `debut`, `frontlist` (a new book by an author with earlier books), `series` or `backlist`. */
  launchKind: said(z.enum(launchKinds)).nullable(),
  /** `traditional` (a publisher sells it to shops) or `indie` (self-published). */
  route: said(z.enum(routes)).nullable(),
  /** `adult`, `ya` or `children`. */
  readership: said(z.enum(readerships)).nullable(),
  /** The formats they name: print, ebook, audio. */
  formats: z.array(said(z.enum(formats))).max(3),
  /** Earlier books by the author, or earlier books in the series, that they name. Anchors, never comps. */
  previousBooks: z.array(said(z.string().min(1))).max(4),
  /** Series or films they compare the book to, for the screen angle. Not comparable books. */
  screenTitles: z.array(said(z.string().min(1))).max(6),
  /** Bookshops, festivals or venues they name for events. */
  bookshops: z.array(said(z.string().min(1))).max(6),
  /** Countries or regions they name, as written ("Europe", "Nigeria"). */
  regions: z.array(said(z.string().min(1))).max(8),
  /**
   * The language, culture or community the book is for, in the person's words. Qloo cannot target
   * it and never receives it: only the writer and the web search do.
   */
  audienceNote: said(z.string().min(1)).nullable(),
  /** The book's genre or subject as a short name ("literary fiction", "romantasy"). */
  genre: said(z.string().min(1)).nullable(),
  /** The publisher's or author's country, as a full country name. */
  country: said(z.string().min(1)).nullable(),
  /** The marketing budget as written, such as "$20,000". Code reads the number. */
  budget: said(z.string().min(1)).nullable(),
  /** Retailers, publicists or brands already signed, as written. */
  partners: z.array(said(z.string().min(1))).max(6),
  /** `full` for a launch plan or an unclear ask, `narrow` for one question such as markets. */
  scope: z.enum(['full', 'narrow']),
  /** The module a narrow ask is about, or null when it is about the core (markets, audience). */
  ask: z.enum(BOOKS_MODULES).nullable(),
  /** Comparable books the person named, exactly as written. */
  comps: z.array(said(z.string().min(1))).max(8),
  /** Cities the person names. */
  places: z.array(said(z.string().min(1))).max(12),
  window: said(z.string().min(1)).nullable(),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
  /**
   * Comparable books the agent proposes when the person named fewer than 3. Not their words, so
   * code checks each one in Qloo and the plan keeps them apart from the person's own.
   */
  suggestedComps: z.array(z.string().min(1)).max(5),
});
export type BooksReading = z.infer<typeof booksReadingSchema>;

/** The reading after code kept only what the person said. Stored in a paused run's state. */
export const booksReadSchema = z.object({
  book: z.string().nullable(),
  author: z.string().nullable(),
  /** Null when the brief does not say; the plan then assumes a debut and says so. */
  launchKind: z.enum(launchKinds).nullable(),
  /** Null when the brief does not say; the plan then assumes a publisher and says so. */
  route: z.enum(routes).nullable(),
  /** Null when the brief does not say; the plan then assumes adult readers and says so. */
  readership: z.enum(readerships).nullable(),
  formats: z.array(z.enum(formats)),
  previousBooks: z.array(z.string()),
  screenTitles: z.array(z.string()),
  bookshops: z.array(z.string()),
  /** The region words as written, for the line check. Their cities are in `places`. */
  regions: z.array(z.string()),
  /** Language, culture or community, for the writer and the web search. Never sent to Qloo. */
  audienceNote: z.string().nullable().default(null),
  genre: z.string().nullable(),
  country: z.string().nullable(),
  budget: budgetSchema.nullable(),
  partners: z.array(z.string()),
  scope: z.enum(['full', 'narrow']),
  ask: z.enum(BOOKS_MODULES).nullable(),
  comps: z.array(z.string()),
  /** Cities the person named. The cities a region word stands for are not here: they were not asked for. */
  places: z.array(z.string()),
  window: z.string().nullable(),
  ages: z.array(z.enum(ageBands)),
  gender: z.enum(['male', 'female']).nullable(),
  suggestedComps: z.array(z.string()),
});
export type BooksRead = z.infer<typeof booksReadSchema> & LaunchRead;

export interface BooksReaderInput {
  title: string;
  /** The first message, the text of its files, and this run's message. */
  text: string;
}

export interface BooksReader {
  read(input: BooksReaderInput): Promise<{ reading: BooksReading; tokens: number }>;
}

/**
 * Keeps only values whose quote is in the person's words. A name must also appear in its own
 * quote, so a model cannot rename a book, an author or a comp.
 */
export function checkReading(reading: BooksReading, input: BooksReaderInput): BooksRead {
  const common = checkCommon(reading, input);
  const { text } = input;
  const own = (item: { value: string; quote: string } | null): string | null =>
    item && inWords(item.quote, text) && inWords(item.value, item.quote) ? item.value.trim() : null;
  const book = own(reading.book);
  const isBook = (name: string) => book !== null && normalise(name) === normalise(book);
  const formatsNamed = [
    ...new Set([
      ...reading.formats.flatMap((f) => (inWords(f.quote, text) ? [f.value] : [])),
      ...booksPlan.formatsFrom(text),
    ]),
  ];
  const kind =
    reading.launchKind && inWords(reading.launchKind.quote, text)
      ? reading.launchKind.value
      : booksPlan.kindFrom(text);
  // The route follows plain words before the model: "an independent press" is a publisher, which a
  // model can read as self-published. The model's route stands only when its own quote says so.
  const route =
    booksPlan.routeFrom(text) ??
    (reading.route &&
    inWords(reading.route.quote, text) &&
    booksPlan.routeFrom(reading.route.quote) === reading.route.value
      ? reading.route.value
      : null);
  const readership =
    reading.readership && inWords(reading.readership.quote, text)
      ? reading.readership.value
      : booksPlan.readershipFrom(text);
  // The model may put a region in "places". A region is not a city, so it moves to regions.
  const cities = common.places.filter((p) => !isRegionWord(p));
  const regions = [
    ...new Set([...namesIn(reading.regions, text), ...common.places.filter(isRegionWord)]),
  ];
  const comps = common.comps.filter((c) => !isBook(c));
  // A title the team named for the screen angle or as an earlier book is theirs already, so it is
  // never added as a comp.
  const taken = [...namedIn(reading.screenTitles, text), ...namedIn(reading.previousBooks, text)];
  // A short brief is enough: when the person named fewer than three books and none were proposed,
  // books like this one, by genre, describe the readers. They are never asked for.
  // A title is the same book with or without the series mark Qloo adds to it.
  const sameBook = (a: string, b: string) => normalizeTitle(a) === normalizeTitle(b);
  const proposed =
    comps.length >= 3 || common.suggestedComps.length > 0
      ? common.suggestedComps
      : fallbackComps(`${common.genre ?? ''} ${text}`);
  const suggested = proposed.filter(
    (n, i) =>
      !isBook(n) &&
      ![...comps, ...taken].some((c) => sameBook(c, n)) &&
      proposed.findIndex((p) => sameBook(p, n)) === i,
  );
  return {
    ...common,
    suggestedComps: suggested,
    comps,
    // A narrow ask names a module this category offers, which the shared check cannot know.
    ask: common.scope === 'full' ? null : reading.ask,
    book,
    author: own(reading.author),
    launchKind: kind,
    route,
    readership,
    formats: formatsNamed,
    previousBooks: namedIn(reading.previousBooks, text).filter((s) => !isBook(s)),
    screenTitles: namedIn(reading.screenTitles, text),
    bookshops: namedIn(reading.bookshops, text),
    regions,
    audienceNote:
      reading.audienceNote && inWords(reading.audienceNote.quote, text)
        ? reading.audienceNote.value.trim().slice(0, 120)
        : null,
    places: cities,
  };
}

export const BOOKS_READ_SYSTEM = `You read a launch brief for a book and pull out what the person said, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- book: the book the launch is for, exactly as written. Never a comp.
- author: the author's name as written. Never a comp.
- launchKind: "debut" for a first book, "frontlist" for a new book by an author who has earlier books, "series" for the next book in a series, "backlist" for a reissue, a new edition or a paperback of a book that is out. Only when the person says so or plainly implies it; otherwise null.
- route: "traditional" when a publisher, an imprint or a press of any size, independent presses included, is publishing it. "indie" only when the author is self-publishing ("self-published", KDP). Only when they say so; otherwise null.
- readership: "children" for picture books and middle grade, "ya" for young adult, "adult" otherwise. Only when they say so or plainly imply it.
- formats: each of print (hardcover, paperback), ebook, audio (audiobook) they name.
- comps: comparable books the person names, or says their readers also read. The value is the title exactly as written. Never include the book itself.
- previousBooks: earlier books by the same author, or earlier books in the same series, that they name. Not a comp.
- screenTitles: series or films they compare the book to, or hope it becomes, exactly as written. Not comps.
- bookshops: bookshops, festivals or venues they name for events.
- places: cities they name. regions: countries or regions they name or write the book for ("Europe", "Nigeria", "West Africa"). A nationality counts: "for Nigerians" gives the value "Nigeria" with "Nigerians" as the quote. Never an ethnic group or any personal detail: leave those out.
- audienceNote: the language, culture or community the book is for, when they say so ("Yoruba speakers", "the Nigerian diaspora"), in their words. It is context for the writer, never for Qloo, so keep it short and never add anything about an individual.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older). "18 to 34" is the first three bands. Quote their words. Never for children: a child's age is not an audience Qloo measures.
- gender: only when they say the readers are mostly women or mostly men.
- genre: the book's genre or subject as a short name in their words ("literary fiction", "romantasy", "memoir").
- country: the author's or publisher's country, as a full country name.
- budget: the marketing budget exactly as written, with its currency.
- partners: retailers, publicists, festivals or brands already signed.
- window: the publication date or window as written ("Q3 2027", "October").
- scope: "full" when they ask for a launch plan, a go-to-market, or help with the launch in general, or when it is unclear. "narrow" only for one specific question, such as which markets, or which comp titles. This field is your judgment, with no quote.
- ask: for a narrow question, the part of a plan it is about: comps (comparable books), adaptation (screen angle), retail, publicity (press, reviews), events, creators, partnerships (brands), community (book clubs), audio, schools, cadence (series and backlist), timeline, budget, measure (what to track), risks. Null when it is about markets or the audience, or when scope is full.
- suggestedComps: whenever they named fewer than 3 comps, even for a one-line brief. Propose well known, real books whose readers are likely the same, from the genre, the market and the readership, enough to reach 3 to 5 in all. Titles only. Code checks each in Qloo. The person is never asked for comps.
- Plain words, no exclamation marks.`;

export class ModelBooksReader implements BooksReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ title, text }: BooksReaderInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: BOOKS_READ_SYSTEM,
      prompt: `Launch title: ${title}\n\nBrief:\n${text}`,
      output: Output.object({ schema: booksReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

// A nationality names who a book is made for, as well as an author's country.
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

// A publication window as people write it: a day, a month, or a quarter.
const WINDOW =
  /\b(?:\d{4}-\d{2}-\d{2}|(?:\d{1,2} )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?: \d{1,2},?)? \d{4}|q[1-4] \d{4})\b/i;

const QUOTED = '["“]([^"”]{2,80})["”]';

const quotedNames = (text: string): string[] =>
  [...text.matchAll(new RegExp(QUOTED, 'g'))].flatMap((m) => (m[1] ? [m[1]] : []));

/** The quoted names after a lead word, and the ones a list of them continues with ("A" and "B"). */
const namesAfter = (text: string, lead: string): string[] =>
  [
    ...text.matchAll(
      new RegExp(
        `\\b(?:${lead})(?: with| like| on| at)?\\s+(${QUOTED}(?:\\s*(?:,|and|or|&)\\s*${QUOTED})*)`,
        'gi',
      ),
    ),
  ].flatMap((m) => quotedNames(m[1] ?? ''));

const PERSON = "[A-Z][\\p{L}'’-]+(?: [A-Z][\\p{L}'’-]+)+";

/**
 * Reads only what is plainly written, for runs with no model key. The book is a name in quotes
 * after the word book, novel or memoir; every other quoted name is a comp, except one after a
 * word like adaptation or a series name. Cities come from the city table, regions from the
 * region table.
 */
export class ScriptedBooksReader implements BooksReader {
  async read({ title, text }: BooksReaderInput) {
    const book = text.match(
      new RegExp(`\\b(?:book|novel|memoir|title|collection|anthology)\\s+${QUOTED}`, 'i'),
    )?.[1];
    const author = text.match(new RegExp(`\\bby\\s+(${PERSON})`, 'u'))?.[1];
    const previousBooks = namesAfter(
      text,
      'sequel to|follow-?up to|after|earlier books?|previous books?|from the author of|book one,|first book,',
    );
    const screenTitles = namesAfter(
      text,
      'adapt\\w*|screen comparison\\w*|compar\\w*(?: it| the book)?|series like|show like|film like|meets|tie-?in|for fans of',
    );
    const bookshops = namesAfter(text, 'bookshop|bookstore|signing at|event at|launch at');
    const taken = [...previousBooks, ...screenTitles, ...bookshops];
    const quotes = [...text.matchAll(new RegExp(QUOTED, 'g'))]
      .flatMap(([, q]) => (q ? [q] : []))
      .filter((q) => q !== book && !taken.includes(q));
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
      /\b(literary(?: fiction| novel)?|romantasy|fantasy romance|romance|fantasy|science fiction|sci-?fi|thriller|mystery|horror|historical fiction|memoir|biography|self[- ]help|business|non-?fiction|young adult|middle grade|children'?s|poetry|graphic novel|cookbook|crime)\b/i,
    )?.[0];
    const demonym = text.match(new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b`, 'i'))?.[0];
    const budget = text.match(
      /(?:[$£€]|\b(?:usd|gbp|eur|cad)\s?)\d[\d,.]*\s?(?:k|m|million|thousand)?\b/i,
    )?.[0];
    const window = text.match(WINDOW)?.[0];
    const builtFor = text.match(
      /\b(?:written|made|built|aimed|targeted)\s+(?:for|at)\s+([^.\n;,]{3,100})/i,
    )?.[1];
    const reading: BooksReading = {
      book: book ? { value: book, quote: book } : null,
      author: author ? { value: author, quote: author } : null,
      // Kind, route, readership and formats are read from the words in `checkReading`, so a run
      // with a model and one without agree on them.
      launchKind: null,
      route: null,
      readership: null,
      formats: [],
      previousBooks: previousBooks.map((s) => ({ value: s, quote: s })),
      screenTitles: screenTitles.map((s) => ({ value: s, quote: s })),
      bookshops: bookshops.map((s) => ({ value: s, quote: s })),
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
      suggestedComps: [],
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

/** Falls back to the scripted reader when the model fails, so a run never stops at reading. */
export class FallbackBooksReader implements BooksReader {
  constructor(
    private readonly primary: BooksReader,
    private readonly fallback: BooksReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: BooksReaderInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
