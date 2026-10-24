import { citiesNear, cityCountry, cityNames } from '@oraqul/engine';
import { booksPlan, brandCategoriesFor } from '@oraqul/packs';
import type { LaunchModuleKey } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import {
  brandChoiceSchema,
  checkBrandCandidates,
  checkWorth,
  FallbackQueryPlanner as LaunchFallbackPlanner,
  type QueryPlanInput as LaunchPlanInput,
  type QueryPlanner as LaunchQueryPlanner,
  orderCities,
  phrase,
  phrases,
  type QueryPlanCore,
  teamCities,
} from '../launch/planner.js';
import { kindOf, readershipOf, routeOf } from './launch-kind.js';
import type { BooksRead } from './read.js';
import { regionCities } from './regions.js';

const { BOOKS_QUERIES, MAX_CITIES_PER_QUERY, KIND_PROFILES } = booksPlan;
type BooksQueryKey = booksPlan.BooksQueryKey;

/**
 * What to ask Qloo, after code has checked it: which catalog queries run and the context that
 * shapes each. Phrases are resolved to Qloo tags before any query uses them.
 */
export interface BooksQueryPlan extends QueryPlanCore {
  queries: BooksQueryKey[];
  /** The author's or publisher's country. Books have no release country filter, so it only orders cities. */
  country: string | null;
  kind: booksPlan.LaunchKind;
  route: booksPlan.Route;
  readership: booksPlan.Readership;
  /** Cities the team's region words stand for. They are ranked, never the team's own cities. */
  regionCities: string[];
  /**
   * The cities the per-city queries (brands, bookshops) ask about: the team's own, or with none
   * the cities its regions stand for, or the kind's usual markets.
   */
  askCities: string[];
  /** A book genre phrase. It narrows the shelf and the podcasts asked for. */
  genre: string | null;
  /** The one city the shelf is asked in: the home market, so it reads like what readers there pick up. */
  shelfCity: string | null;
  /** Series and films, by exact name, that the bridge scores for the readers. */
  screenSeries: string[];
  screenFilms: string[];
  bookshopCities: string[];
  brandCategories: string[];
  brandCities: string[];
}

export type QueryPlanInput = LaunchPlanInput<BooksRead>;
export type QueryPlanner = LaunchQueryPlanner<BooksRead, BooksQueryPlan>;

/** Which catalog queries a plan with these modules runs (spec §4.5). */
export function queriesFor(modules: LaunchModuleKey[]): BooksQueryKey[] {
  return booksPlan.booksQueryKeys.filter((key) => {
    const spec = BOOKS_QUERIES[key];
    return spec.for === 'core' || modules.includes(spec.for);
  });
}

/** The defaults: the pack's tables applied to the brief. Also the scripted planner's answer. */
export function defaultPlan(input: QueryPlanInput): BooksQueryPlan {
  const { read, modules } = input;
  const country = read.country ?? input.compsCountry;
  const cities = orderCities(read.places, country);
  const kind = kindOf(read).kind;
  const home = cities.filter((c) => country !== null && cityCountry(c) === country);
  // Cities a region word stands for are ranked, but never become the team's own assumptions.
  const regional = regionCities(read.regions).filter(
    (c) => !cities.some((t) => t.toLowerCase() === c.toLowerCase()),
  );
  const worthALook = [
    ...new Set([
      ...regional,
      ...(cities.length ? citiesNear(cities, 4) : []),
      ...(cities.length || regional.length ? [] : KIND_PROFILES[kind].defaultCities),
    ]),
  ].slice(0, 8);
  const askCities = cities.length ? cities : worthALook.slice(0, MAX_CITIES_PER_QUERY);
  // The markets and who the book is for tell a Nigerian family saga from an American one.
  const market = [...read.regions, ...read.places, read.audienceNote, read.country]
    .filter(Boolean)
    .join(' ');
  // What the person said the book is about comes first; the title is only a last resort.
  const genre =
    (read.genre ? booksPlan.genrePhrase(`${read.genre} ${market}`) : null) ??
    booksPlan.genrePhrase(`${input.title} ${market}`);
  const words = `${read.genre ?? ''} ${input.title} ${market}`;
  const screen = booksPlan.screenCandidates(words);
  return {
    queries: queriesFor(modules),
    cities,
    // With no cities named, the usual markets are ranked and shown as the plan's markets.
    worthALook,
    country,
    kind,
    route: routeOf(read).route,
    readership: readershipOf(read).readership,
    regionCities: regional,
    askCities,
    genre,
    shelfCity: home[0] ?? null,
    screenSeries: screen.series,
    screenFilms: screen.films,
    bookshopCities: askCities.slice(0, 3),
    brandCategories: brandCategoriesFor('books'),
    brandCities: (cities.length ? [home[0] ?? cities[0], cities[1]] : askCities.slice(0, 2))
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    areas: [],
    brandCandidates: [],
  };
}

export class ScriptedQueryPlanner implements QueryPlanner {
  async plan(input: QueryPlanInput) {
    return { plan: defaultPlan(input), tokens: 0 };
  }
}

// What the model may change about the defaults. Flat and nullable, for every provider.
const modelPlanSchema = z.object({
  genre: phrase.nullable(),
  shelfCity: z.string().nullable(),
  bookshopCities: z.array(z.string()).max(4),
  brandCategories: z.array(phrase).max(3),
  brandCities: z.array(z.string()).max(4),
  worthALook: z.array(z.string()).max(4),
  brandCandidates: z.array(brandChoiceSchema).max(5),
  screenSeries: z.array(phrase).max(booksPlan.BRIDGE_PER_MEDIUM),
  screenFilms: z.array(phrase).max(booksPlan.BRIDGE_PER_MEDIUM),
});

export const QUERY_PLAN_SYSTEM = `You shape the questions Oraqul asks Qloo, a taste data API, for a book launch. Oraqul describes the launch by the book and its comparable books and asks what their readers like. On its own that drifts to what is popular overall; context makes it sharp. You pick the context from your knowledge of the book's genre and markets.

You are given the brief and default choices. Return the choices, changed only where your knowledge of this launch makes them sharper.

- genre: a book genre phrase that fits the book ("literary fiction", "romance", "fantasy romance", "thriller", "mystery", "young adult", "children", "memoir", "self help", "business", "non fiction", "african literature", "historical fiction", "science fiction", "poetry"). It narrows the books asked for. Null keeps the default.
- shelfCity, bookshopCities, brandCities: only cities from "Cities to ask about". Up to ${MAX_CITIES_PER_QUERY}.
- brandCategories: short brand category names whose brands fit a book partnership ("beverage", "telecom", "food delivery", "banking"). Never luxury.
- brandCandidates: for each of the cities to ask about, up to 4 brands that operate there and could realistically partner with a book launch: coffee and tea, telecoms, stationery, apps, local retailers, banks. Write each as the company's usual name. Never a global giant that does no small partnerships. Qloo then ranks only these, per city, for the readers.
- screenSeries and screenFilms: up to ${booksPlan.BRIDGE_PER_MEDIUM} real series and films that could plausibly be a screen comparison for this book: adaptations of similar books, or screen stories that sit next to its themes and tone. Write each as its usual title, exactly. Qloo then ranks only these for the readers. Empty keeps the defaults.
- worthALook: up to 4 other cities from the city table where these readers may be strong. They are only shown as alternatives, never in place of the team's cities.

Never name a person. Never use words from the brief that describe a private individual.`;

export class ModelQueryPlanner implements QueryPlanner {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async plan(input: QueryPlanInput) {
    const defaults = defaultPlan(input);
    const { read } = input;
    const brief = [
      `Launch: ${input.title} (${defaults.kind}, ${defaults.route}, ${defaults.readership} readers)`,
      read.genre ? `Genre: ${read.genre}` : '',
      read.country ? `Country: ${read.country}` : '',
      `Team's cities: ${defaults.cities.join(', ') || 'none'}`,
      `Cities to ask about: ${defaults.askCities.join(', ') || 'none'}`,
      read.regions.length ? `Team's regions: ${read.regions.join(', ')}` : '',
      read.audienceNote ? `Made for: ${read.audienceNote}` : '',
      read.ages.length ? `Age bands: ${read.ages.join(', ')}` : '',
      `City table: ${cityNames().join(', ')}`,
      `Defaults: ${JSON.stringify(defaults)}`,
    ].filter(Boolean);
    const { output, usage } = await generateText({
      model: this.model,
      system: QUERY_PLAN_SYSTEM,
      prompt: brief.join('\n'),
      output: Output.object({ schema: modelPlanSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { plan: checkPlan(output, defaults), tokens: usage.totalTokens ?? 0 };
  }
}

/**
 * Keeps the model's choices only where code allows them: cities must be the team's, "Worth a
 * look" must be table cities the team did not name, and a list left empty keeps the default.
 */
export function checkPlan(
  chosen: z.infer<typeof modelPlanSchema>,
  defaults: BooksQueryPlan,
): BooksQueryPlan {
  const team = (list: string[]) => teamCities(list, defaults.askCities);
  const keep = (list: string[], fallback: string[]) => {
    const kept = [...new Set(team(list))].slice(0, MAX_CITIES_PER_QUERY);
    return kept.length ? kept : fallback;
  };
  const titles = (list: string[], fallback: string[]) => {
    const kept = [...new Set(phrases(list))].slice(0, booksPlan.BRIDGE_PER_MEDIUM);
    return kept.length ? kept : fallback;
  };
  return {
    ...defaults,
    genre: phrases([chosen.genre ?? ''])[0] ?? defaults.genre,
    shelfCity: team(chosen.shelfCity ? [chosen.shelfCity] : [])[0] ?? defaults.shelfCity,
    bookshopCities: keep(chosen.bookshopCities, defaults.bookshopCities),
    brandCategories: phrases(chosen.brandCategories).length
      ? phrases(chosen.brandCategories)
      : defaults.brandCategories,
    brandCities: keep(chosen.brandCities, defaults.brandCities),
    screenSeries: titles(chosen.screenSeries, defaults.screenSeries),
    screenFilms: titles(chosen.screenFilms, defaults.screenFilms),
    // With no team cities the regions are the plan's markets, so the model cannot swap them.
    worthALook:
      defaults.cities.length && defaults.regionCities.length === 0
        ? checkWorth(chosen.worthALook, defaults.cities, defaults.worthALook)
        : defaults.worthALook,
    brandCandidates: checkBrandCandidates(chosen.brandCandidates, defaults.askCities),
  };
}

export class FallbackQueryPlanner extends LaunchFallbackPlanner<BooksRead, BooksQueryPlan> {}
