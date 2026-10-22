import { resolveTagsOutputSchema, themeTagsOutputSchema, tools } from '@oraqul/engine';
import { filmPlan } from '@oraqul/packs';
import type { BriefLabels } from '../launch/brief.js';
import {
  agesPhrase,
  brandPool,
  capitalise,
  entity,
  type GroundDeps,
  type Grounded,
  type GroundKit,
  type GroundSpec,
  ground as groundLaunch,
  type GroundInput as LaunchGroundInput,
  list,
  plural,
  type Voice,
} from '../launch/findings.js';
import { slug } from './brief.js';
import type { QueryPlan } from './planner.js';
import type { FilmRead } from './read.js';

export type { GroundDeps, Grounded } from '../launch/findings.js';
export { agesPhrase, list } from '../launch/findings.js';

const { CINEMA_TAG, RECENT_FILMS, RECENT_SHOWS, TAG_SPACES, MAX_CITIES_PER_QUERY } = filmPlan;

// Most calls the brand and community queries make between them, so they cannot spend the run.
const MAX_BRAND_CALLS = 4;
const MAX_COMMUNITY_CALLS = 8;
const MAX_VENUE_CALLS = 6;

export type GroundInput = LaunchGroundInput<FilmRead, QueryPlan>;

const VOICE: Voice = {
  audience: "the comps' audience",
  yourAudience: "your comps' audience",
  theseComps: 'these comps',
  compsVerdict: {
    holds: 'Your comps point to one audience.',
    weak: 'Your comps lean on one title for the result, so another comp of your own would firm it up.',
    breaks: 'Your comps point to different audiences.',
    cant: 'Your comps could not be compared as one audience.',
  },
};

const labels = (read: FilmRead): BriefLabels => ({
  marketNoun: read.format ?? 'title',
  compsClaim: 'The comps describe one audience',
  sales: {
    item: 'Box office and viewing numbers',
    reason: 'Qloo has taste data, not sales. Add your own numbers when you fix a plan.',
  },
});

/**
 * Stage 1 (spec §4.1). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 */
export function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  return groundLaunch(deps, input, {
    voice: VOICE,
    labels,
    queryOrder: filmPlan.filmQueryKeys,
    runQueries,
  } satisfies GroundSpec<FilmRead, QueryPlan>);
}

async function runQueries(kit: GroundKit<FilmRead, QueryPlan>): Promise<void> {
  const { deps, read, plan, ids, gaps, want, jobs, taste, add } = kit;
  const ages = read.ages;
  const agesText = read.ages.length ? ` ${agesPhrase(read.ages)}` : '';
  const tags = await resolve(deps, plan, want);

  if (want('themes')) {
    const run = await kit.safely('Themes and archetypes', () =>
      tools.themeTags.run(deps.tools, { entityIds: ids, kinds: ['theme'] }),
    );
    if (run) {
      const out = themeTagsOutputSchema.parse(run.data);
      const [call] = run.receipts;
      const themes = out.kinds.find((k) => k.kind === 'theme')?.tags ?? [];
      const archetypes = out.kinds.find((k) => k.kind === 'archetype')?.tags ?? [];
      if (call && themes.length) {
        add(
          {
            id: 'f-themes',
            query: 'themes',
            text: `Your comps share the themes ${list(themes.slice(0, 4).map((t) => t.name.toLowerCase()))}${archetypes.length ? `, and the archetypes ${list(archetypes.slice(0, 3).map((t) => t.name))}` : ''}.`,
            entities: [...themes, ...archetypes].map((t) => entity(t.name, t.affinity, null)),
            verdict: null,
            confidence: out.confidence,
            why: out.why,
          },
          call,
        );
      } else {
        gaps.push({ item: 'Themes', why: 'Qloo returned no themes for the comps.' });
      }
    }
  }

  if (want('shows')) {
    const from = kit.year - RECENT_SHOWS;
    for (const city of plan.showCities.slice(0, MAX_CITIES_PER_QUERY)) {
      jobs.push(
        taste(
          'shows',
          `Series in ${city}`,
          `f-shows-${slug(city)}`,
          { type: 'urn:entity:tv_show', city, yearFrom: from },
          (names) =>
            `In ${city}, the series since ${from} that rank highest with your comps' audience are ${names}.`,
          { city, yearFrom: from },
        ),
      );
    }
  }

  if (want('cinemas') && tags.cinemas) {
    for (const city of plan.cities.slice(0, MAX_CITIES_PER_QUERY)) {
      jobs.push(
        taste(
          'cinemas',
          `Cinemas in ${city}`,
          `f-cinemas-${slug(city)}`,
          { type: 'urn:entity:place', tags: [tags.cinemas.id], city },
          (names) =>
            `In ${city}, the cinemas that rank highest with your comps' audience are ${names}.`,
          { city, tags: [tags.cinemas.name] },
        ),
      );
    }
  }

  if (want('music')) {
    const scene = tags.music;
    if (!scene) {
      gaps.push({
        item: 'Music and soundtrack',
        why: plan.musicScene
          ? `Qloo has no music tag for "${plan.musicScene}", so artists were not asked: without a scene the list drifts to what is popular overall.`
          : 'No music scene fits the brief, so artists were not asked: without a scene the list drifts to what is popular overall.',
      });
    } else {
      for (const city of plan.musicCities.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'music',
            `Artists in ${city}`,
            `f-music-${slug(city)}`,
            { type: 'urn:entity:artist', tags: [scene.id], city, ages },
            (names) =>
              `In ${city}, the ${scene.name} artists that rank highest with your comps' audience${agesText} are ${names}.`,
            { city, tags: [scene.name], ages: read.ages },
          ),
        );
      }
    }
  }

  if (want('brands')) {
    // Brands Qloo likes best are the biggest names, which would never say yes to a small film.
    // So the model names brands that could, Qloo finds them, and Qloo ranks only those.
    const pools = (
      await Promise.all(
        plan.brandCandidates.map(async ({ city, names }) => ({
          city,
          pool: await brandPool(deps, names),
        })),
      )
    ).filter((p) => p.pool.length >= 2);
    if (pools.length > 0) {
      for (const { city, pool } of pools.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'brands',
            `Partner brands in ${city}`,
            `f-brands-${slug(city)}`,
            { type: 'urn:entity:brand', city, only: pool },
            (names) =>
              `In ${city}, among brands that could realistically partner with a film like this, your comps' audience likes ${names} best.`,
            { city },
          ),
        );
      }
    } else {
      // No usable candidates: ask Qloo by category.
      const pairs = tags.brands.flatMap((tag) => plan.brandCities.map((city) => ({ tag, city })));
      for (const { tag, city } of pairs.slice(0, MAX_BRAND_CALLS)) {
        jobs.push(
          taste(
            'brands',
            `${capitalise(tag.name)} brands in ${city}`,
            `f-brands-${slug(tag.name)}-${slug(city)}`,
            { type: 'urn:entity:brand', tags: [tag.id], city },
            (names) =>
              `In ${city}, the ${tag.name.toLowerCase()} brands that rank highest with your comps' audience are ${names}.`,
            { city, tags: [tag.name] },
          ),
        );
      }
      if (tags.brands.length === 0) {
        gaps.push({
          item: 'Brand partners',
          why: 'Qloo had no brand category for the ones asked.',
        });
      }
    }
  }

  if (want('films')) {
    const from = kit.year - RECENT_FILMS;
    const genre = tags.films;
    if (!plan.country && !genre) {
      gaps.push({
        item: 'Trailer pairings',
        why: 'No country of origin or genre to filter recent films by, and an open list drifts to what is popular overall.',
      });
    } else {
      const what = plan.country ?? genre?.name ?? '';
      jobs.push(
        taste(
          'films',
          'Recent films',
          'f-films',
          {
            type: 'urn:entity:movie',
            yearFrom: from,
            ...(plan.country ? { country: plan.country } : { tags: genre ? [genre.id] : [] }),
          },
          (names) =>
            `The ${plan.country ? `films from ${what}` : `${what.toLowerCase()} films`} since ${from} that rank highest with your comps' audience are ${names}.`,
          { country: plan.country, yearFrom: from, tags: genre ? [genre.name] : [] },
        ),
      );
    }
  }

  if (want('podcasts')) {
    const genre = tags.podcasts;
    const city = plan.podcastCity;
    jobs.push(
      taste(
        'podcasts',
        'Podcasts',
        'f-podcasts',
        { type: 'urn:entity:podcast', tags: genre ? [genre.id] : [], city },
        (names) =>
          `The ${genre ? `${genre.name.toLowerCase()} ` : ''}podcasts that rank highest with your comps' audience${city ? ` in ${city}` : ''} are ${names}.`,
        { city, tags: genre ? [genre.name] : [] },
      ),
    );
  }

  if (want('games')) {
    for (const city of plan.gameCities.slice(0, MAX_CITIES_PER_QUERY)) {
      jobs.push(
        taste(
          'games',
          `Games in ${city}`,
          `f-games-${slug(city)}`,
          { type: 'urn:entity:videogame', city },
          (names) =>
            `In ${city}, the games that rank highest with your comps' audience are ${names}.`,
          { city },
        ),
      );
    }
  }

  if (want('venues')) {
    const pairs = tags.venues.flatMap((tag) => plan.venueCities.map((city) => ({ tag, city })));
    for (const { tag, city } of pairs.slice(0, MAX_VENUE_CALLS)) {
      jobs.push(
        taste(
          'venues',
          `${capitalise(plural(tag.name))} in ${city}`,
          `f-venues-${slug(tag.name)}-${slug(city)}`,
          { type: 'urn:entity:place', tags: [tag.id], city },
          (names) =>
            `In ${city}, the ${plural(tag.name)} that rank highest with your comps' audience are ${names}.`,
          { city, tags: [tag.name] },
        ),
      );
    }
  }

  if (want('community')) {
    const pairs = tags.community.flatMap((tag) =>
      plan.communityCities.map((city) => ({ tag, city })),
    );
    for (const { tag, city } of pairs.slice(0, MAX_COMMUNITY_CALLS)) {
      jobs.push(
        taste(
          'community',
          `${capitalise(plural(tag.name))} in ${city}`,
          `f-community-${slug(tag.name)}-${slug(city)}`,
          { type: 'urn:entity:place', tags: [tag.id], city },
          (names) =>
            `In ${city}, the ${plural(tag.name)} that rank highest with your comps' audience are ${names}.`,
          { city, tags: [tag.name] },
        ),
      );
    }
  }
}

interface Tag {
  id: string;
  name: string;
}

// Every phrase the plan needs, resolved to Qloo tags in one tool run. Unmatched ones drop out.
async function resolve(
  deps: GroundDeps,
  plan: QueryPlan,
  want: (key: string) => boolean,
): Promise<{
  music: Tag | null;
  podcasts: Tag | null;
  films: Tag | null;
  cinemas: Tag | null;
  brands: Tag[];
  community: Tag[];
  venues: Tag[];
}> {
  type Ask = { phrase: string; space: keyof typeof TAG_SPACES };
  const asks: Ask[] = [
    ...(want('music') && plan.musicScene
      ? [{ phrase: plan.musicScene, space: 'music' as const }]
      : []),
    ...(want('podcasts') && plan.podcastGenre
      ? [{ phrase: plan.podcastGenre, space: 'podcasts' as const }]
      : []),
    ...(want('films') && !plan.country && plan.filmGenre
      ? [{ phrase: plan.filmGenre, space: 'films' as const }]
      : []),
    ...(want('cinemas') ? [{ phrase: CINEMA_TAG, space: 'cinemas' as const }] : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
    ...(want('community')
      ? plan.communityPlaces.slice(0, 2).map((phrase) => ({ phrase, space: 'community' as const }))
      : []),
    ...(want('venues')
      ? plan.venuePlaces.slice(0, 2).map((phrase) => ({ phrase, space: 'venues' as const }))
      : []),
  ];
  const empty = {
    music: null,
    podcasts: null,
    films: null,
    cinemas: null,
    brands: [],
    community: [],
    venues: [],
  };
  if (asks.length === 0) return empty;
  const run = await tools.resolveTags.run(deps.tools, {
    phrases: asks.map(({ phrase, space }) => ({
      phrase,
      prefix: TAG_SPACES[space].prefix,
      parent: TAG_SPACES[space].parent,
    })),
  });
  deps.keep(run.receipts);
  const found = resolveTagsOutputSchema.parse(run.data).tags;
  const tagFor = (i: number): Tag | null => {
    const t = found[i];
    return t?.tagId ? { id: t.tagId, name: t.name ?? t.phrase } : null;
  };
  const of = (space: Ask['space']) =>
    asks.flatMap((a, i) => (a.space === space ? (tagFor(i) ?? []) : []));
  return {
    music: of('music')[0] ?? null,
    podcasts: of('podcasts')[0] ?? null,
    films: of('films')[0] ?? null,
    cinemas: of('cinemas')[0] ?? null,
    brands: of('brands'),
    community: of('community'),
    venues: of('venues'),
  };
}
