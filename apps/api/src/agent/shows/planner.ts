import { citiesNear, cityCountry, cityNames } from '@oraqul/engine';
import { brandCategoriesFor, showsPlan } from '@oraqul/packs';
import type { LaunchModuleKey } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import {
  areaChoiceSchema,
  brandChoiceSchema,
  checkAreas,
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
import type { ShowsRead } from './read.js';

const { SHOWS_QUERIES, MAX_CITIES_PER_QUERY, SHOWS_VENUE_PLACES } = showsPlan;
type ShowsQueryKey = showsPlan.ShowsQueryKey;

/**
 * What to ask Qloo, after code has checked it: which catalog queries run and the context that
 * shapes each. Phrases are resolved to Qloo tags before any query uses them.
 */
export interface ShowsQueryPlan extends QueryPlanCore {
  queries: ShowsQueryKey[];
  country: string | null;
  /** The sound, as a phrase to resolve to a music tag. No scene: similar acts are not asked. */
  scene: string | null;
  similarCities: string[];
  brandCategories: string[];
  brandCities: string[];
  podcastGenre: string | null;
  podcastCity: string | null;
  venuePlaces: string[];
  venueCities: string[];
}

export type QueryPlanInput = LaunchPlanInput<ShowsRead>;
export type QueryPlanner = LaunchQueryPlanner<ShowsRead, ShowsQueryPlan>;

/** Which catalog queries a plan with these modules runs (spec §4.6). */
export function queriesFor(modules: LaunchModuleKey[]): ShowsQueryKey[] {
  return showsPlan.showsQueryKeys.filter((key) => {
    const spec = SHOWS_QUERIES[key];
    return spec.for === 'core' || modules.includes(spec.for);
  });
}

/** The defaults: the pack's tables applied to the brief. Also the scripted planner's answer. */
export function defaultPlan(input: QueryPlanInput): ShowsQueryPlan {
  const { read, modules } = input;
  const country = read.country ?? input.compsCountry;
  const cities = orderCities(read.places, country);
  const home = cities.filter((c) => country !== null && cityCountry(c) === country);
  const away = cities.filter((c) => !home.includes(c));
  const scene =
    phrases([read.genre ?? ''])[0] ??
    (country ? (showsPlan.MUSIC_SCENES[country.toLowerCase()] ?? null) : null);
  const genre = read.genre ?? '';
  return {
    queries: queriesFor(modules),
    cities,
    worthALook: citiesNear(cities, 4),
    country,
    // A comedy night, a play and a screening have no music scene to ask about.
    scene: read.showType === 'concert' || read.showType === 'club' || !read.showType ? scene : null,
    similarCities: cities,
    brandCategories: brandCategoriesFor('shows'),
    brandCities: [home[0] ?? cities[0], away[0]]
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    podcastGenre: showsPlan.PODCAST_GENRES.find((g) => g.match.test(genre))?.phrase ?? null,
    podcastCity: away[0] ?? cities[0] ?? null,
    venuePlaces: SHOWS_VENUE_PLACES[read.showType ?? showsPlan.DEFAULT_SHOW_TYPE],
    venueCities: cities,
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
  scene: phrase.nullable(),
  similarCities: z.array(z.string()).max(5),
  brandCategories: z.array(phrase).max(3),
  brandCities: z.array(z.string()).max(4),
  podcastGenre: phrase.nullable(),
  podcastCity: z.string().nullable(),
  venuePlaces: z.array(phrase).max(3),
  venueCities: z.array(z.string()).max(5),
  worthALook: z.array(z.string()).max(4),
  country: z.string().nullable(),
  areas: z.array(areaChoiceSchema).max(20),
  brandCandidates: z.array(brandChoiceSchema).max(5),
});

export const QUERY_PLAN_SYSTEM = `You shape the questions Oraqul asks Qloo, a taste data API, for a single live show or a short run. Oraqul describes the show by its act and comparable acts and asks what their audience likes. On its own that drifts to what is popular overall; context makes it sharp. You pick the context from your knowledge of the act's scene and markets.

You are given the brief and default choices. Return the choices, changed only where your knowledge of this show makes them sharper.

- scene: the music genre of a concert or club act's sound, as a short genre name ("afrobeats", "amapiano", "drill"). Null for comedy, theatre and screenings, and when none fits.
- similarCities, brandCities, venueCities, podcastCity: only cities from the team's list. Up to ${MAX_CITIES_PER_QUERY}. Put the cities where the answer matters most first.
- brandCategories: short brand category names whose brands operate in these cities and fit a show tie-in ("telecom", "beverage"). Never luxury.
- podcastGenre: a podcast genre that fits the act ("comedy", "music", "pop culture").
- venuePlaces: kinds of place where this audience goes out ("comedy club", "night club", "concert hall", "theater", "movie theater").
- areas: for each of the team's cities, up to 5 neighbourhoods or districts where this audience goes out, each with the latitude and longitude of its centre. Real, well-known places only, inside the city.
- brandCandidates: for each of the team's cities, up to 4 brands that operate in that city and could realistically sponsor a single show as an in-kind or co-promotion tie-in: telecoms, ride-hailing, fintech, drinks and ticketing brands. Write each as the company's usual name. Never a global giant that does not do small tie-ins.
- worthALook: up to 4 other cities from the city table where this audience may be strong. They are only shown as alternatives, never in place of the team's cities.
- country: the act's country as a full name, or null.

Never name a person. Never use words from the brief that describe a private individual. Never state a ticket price, a capacity or a date: those are the team's.`;

export class ModelQueryPlanner implements QueryPlanner {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async plan(input: QueryPlanInput) {
    const defaults = defaultPlan(input);
    const { read } = input;
    const brief = [
      `Show: ${input.title} (${read.showType ?? 'live show'})`,
      read.genre ? `Sound or kind of act: ${read.genre}` : '',
      read.country ? `Country: ${read.country}` : '',
      `Team's cities: ${defaults.cities.join(', ') || 'none'}`,
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
  defaults: ShowsQueryPlan,
): ShowsQueryPlan {
  const team = (list: string[]) => teamCities(list, defaults.cities);
  const keep = (list: string[], fallback: string[]) => {
    const kept = [...new Set(team(list))].slice(0, MAX_CITIES_PER_QUERY);
    return kept.length ? kept : fallback;
  };
  return {
    ...defaults,
    country: defaults.country ?? chosen.country,
    // A show with no music scene stays without one, whatever the model proposes.
    scene: defaults.scene === null ? null : (phrases([chosen.scene ?? ''])[0] ?? defaults.scene),
    similarCities: keep(chosen.similarCities, defaults.similarCities),
    brandCategories: phrases(chosen.brandCategories).length
      ? phrases(chosen.brandCategories)
      : defaults.brandCategories,
    brandCities: keep(chosen.brandCities, defaults.brandCities),
    podcastGenre: phrases([chosen.podcastGenre ?? ''])[0] ?? defaults.podcastGenre,
    podcastCity: team(chosen.podcastCity ? [chosen.podcastCity] : [])[0] ?? defaults.podcastCity,
    venuePlaces: phrases(chosen.venuePlaces).length
      ? phrases(chosen.venuePlaces)
      : defaults.venuePlaces,
    venueCities: keep(chosen.venueCities, defaults.venueCities),
    worthALook: checkWorth(chosen.worthALook, defaults.cities, defaults.worthALook),
    areas: checkAreas(chosen.areas, defaults.cities),
    brandCandidates: checkBrandCandidates(chosen.brandCandidates, defaults.cities),
  };
}

export class FallbackQueryPlanner extends LaunchFallbackPlanner<ShowsRead, ShowsQueryPlan> {}
