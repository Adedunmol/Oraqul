import { citiesNear, cityCountry, cityNames } from '@oraqul/engine';
import { brandCategoriesFor, gamesPlan } from '@oraqul/packs';
import type { FanMedium, LaunchModuleKey } from '@oraqul/schema';
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
import { kindOf, platformsOf } from './launch-kind.js';
import type { GamesRead } from './read.js';
import { regionCities } from './regions.js';

const { GAMES_QUERIES, MAX_CITIES_PER_QUERY, FAN_MEDIA, KIND_PROFILES } = gamesPlan;
type GamesQueryKey = gamesPlan.GamesQueryKey;

/**
 * What to ask Qloo, after code has checked it: which catalog queries run and the context that
 * shapes each. Phrases are resolved to Qloo tags before any query uses them.
 */
export interface GamesQueryPlan extends QueryPlanCore {
  queries: GamesQueryKey[];
  /** The studio's country. Games have no release country filter, so it only orders cities. */
  country: string | null;
  kind: gamesPlan.LaunchKind;
  platforms: gamesPlan.Platform[];
  /** Cities the team's region words stand for. They are ranked, never the team's own cities. */
  regionCities: string[];
  /**
   * The cities the per-city queries (brands, podcasts, campuses) ask about: the team's own, or
   * with none the cities its regions stand for, or the kind's usual markets.
   */
  askCities: string[];
  /** The fan bases the bridge ranks, a subset of the seven by default all of them. */
  fanMedia: FanMedium[];
  /** A podcast genre phrase for gaming podcasts. */
  podcastGenre: string | null;
  podcastCity: string | null;
  brandCategories: string[];
  brandCities: string[];
  communityPlaces: string[];
  communityCities: string[];
}

export type QueryPlanInput = LaunchPlanInput<GamesRead>;
export type QueryPlanner = LaunchQueryPlanner<GamesRead, GamesQueryPlan>;

/** Which catalog queries a plan with these modules runs (spec §4.3). */
export function queriesFor(modules: LaunchModuleKey[]): GamesQueryKey[] {
  return gamesPlan.gamesQueryKeys.filter((key) => {
    const spec = GAMES_QUERIES[key];
    return spec.for === 'core' || modules.includes(spec.for);
  });
}

/** The defaults: the pack's tables applied to the brief. Also the scripted planner's answer. */
export function defaultPlan(input: QueryPlanInput): GamesQueryPlan {
  const { read, modules } = input;
  const country = read.country ?? input.compsCountry;
  const cities = orderCities(read.places, country);
  const kind = kindOf(read).kind;
  const home = cities.filter((c) => country !== null && cityCountry(c) === country);
  const away = cities.filter((c) => !home.includes(c));
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
  return {
    queries: queriesFor(modules),
    cities,
    // With no cities named, the kind's usual markets are ranked and shown as the plan's regions.
    worthALook,
    country,
    kind,
    regionCities: regional,
    askCities,
    platforms: platformsOf(read),
    fanMedia: FAN_MEDIA.map((m) => m.medium),
    podcastGenre: gamesPlan.FAN_MEDIA.find((m) => m.medium === 'podcast')?.phrase ?? null,
    podcastCity: away[0] ?? askCities[0] ?? null,
    brandCategories: brandCategoriesFor('games'),
    brandCities: (cities.length ? [home[0] ?? cities[0], away[0]] : askCities.slice(0, 2))
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    communityPlaces: gamesPlan.GAMES_COMMUNITY_PLACES,
    communityCities: askCities.slice(0, MAX_CITIES_PER_QUERY),
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
  podcastGenre: phrase.nullable(),
  podcastCity: z.string().nullable(),
  brandCategories: z.array(phrase).max(3),
  brandCities: z.array(z.string()).max(4),
  communityPlaces: z.array(phrase).max(3),
  communityCities: z.array(z.string()).max(5),
  worthALook: z.array(z.string()).max(4),
  brandCandidates: z.array(brandChoiceSchema).max(5),
});

export const QUERY_PLAN_SYSTEM = `You shape the questions Oraqul asks Qloo, a taste data API, for a video game launch. Oraqul describes the launch by the game and its comparable games and asks what their players like. On its own that drifts to what is popular overall; context makes it sharp. You pick the context from your knowledge of the game's genre and markets.

You are given the brief and default choices. Return the choices, changed only where your knowledge of this launch makes them sharper.

- podcastGenre: a podcast genre phrase that fits the game ("video games", "gaming news", "anime"). Null keeps the default.
- podcastCity, brandCities, communityCities: only cities from "Cities to ask about". Up to ${MAX_CITIES_PER_QUERY}.
- brandCategories: short brand category names whose brands fit a game tie-in ("beverage", "telecom", "gaming peripherals", "food delivery"). Never luxury.
- communityPlaces: kinds of place where this audience gathers ("university").
- brandCandidates: for each of the cities to ask about, up to 4 brands that operate there and could realistically partner with an independent studio as an in-kind or co-promotion tie-in: energy drinks, peripherals, telecoms, food delivery, challenger brands. Write each as the company's usual name. Never a global giant that does no small tie-ins. Qloo then ranks only these, per city, for the players.
- worthALook: up to 4 other cities from the city table where this audience may be strong. They are only shown as alternatives, never in place of the team's cities.

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
      `Launch: ${input.title} (${defaults.kind}, on ${defaults.platforms.join(', ')})`,
      read.genre ? `Genre: ${read.genre}` : '',
      read.country ? `Studio country: ${read.country}` : '',
      `Team's cities: ${defaults.cities.join(', ') || 'none'}`,
      `Cities to ask about: ${defaults.askCities.join(', ') || 'none'}`,
      read.regions.length ? `Team's regions: ${read.regions.join(', ')}` : '',
      read.audienceNote ? `Built for: ${read.audienceNote}` : '',
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
  defaults: GamesQueryPlan,
): GamesQueryPlan {
  const team = (list: string[]) => teamCities(list, defaults.askCities);
  const keep = (list: string[], fallback: string[]) => {
    const kept = [...new Set(team(list))].slice(0, MAX_CITIES_PER_QUERY);
    return kept.length ? kept : fallback;
  };
  return {
    ...defaults,
    podcastGenre: phrases([chosen.podcastGenre ?? ''])[0] ?? defaults.podcastGenre,
    podcastCity: team(chosen.podcastCity ? [chosen.podcastCity] : [])[0] ?? defaults.podcastCity,
    brandCategories: phrases(chosen.brandCategories).length
      ? phrases(chosen.brandCategories)
      : defaults.brandCategories,
    brandCities: keep(chosen.brandCities, defaults.brandCities),
    communityPlaces: phrases(chosen.communityPlaces).length
      ? phrases(chosen.communityPlaces)
      : defaults.communityPlaces,
    communityCities: keep(chosen.communityCities, defaults.communityCities),
    // With no team cities the regions are the plan's regions, so the model cannot swap them.
    worthALook:
      defaults.cities.length && defaults.regionCities.length === 0
        ? checkWorth(chosen.worthALook, defaults.cities, defaults.worthALook)
        : defaults.worthALook,
    brandCandidates: checkBrandCandidates(chosen.brandCandidates, defaults.askCities),
  };
}

export class FallbackQueryPlanner extends LaunchFallbackPlanner<GamesRead, GamesQueryPlan> {}
