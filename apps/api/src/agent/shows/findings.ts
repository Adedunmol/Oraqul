import { resolveTagsOutputSchema, tools } from '@oraqul/engine';
import { showsPlan } from '@oraqul/packs';
import { brandPools } from '../launch/brands.js';
import type { BriefLabels } from '../launch/brief.js';
import { slug } from '../launch/brief.js';
import {
  agesPhrase,
  BRAND_BAND,
  capitalise,
  type GroundDeps,
  type Grounded,
  type GroundKit,
  type GroundSpec,
  ground as groundLaunch,
  type GroundInput as LaunchGroundInput,
  plural,
  type Voice,
} from '../launch/findings.js';
import type { ShowsQueryPlan } from './planner.js';
import type { ShowsRead } from './read.js';

export type { GroundDeps, Grounded } from '../launch/findings.js';

const { TAG_SPACES, MAX_CITIES_PER_QUERY } = showsPlan;

// Most calls the brand and venue queries make between them, so they cannot spend the run.
const MAX_BRAND_CALLS = 4;
const MAX_VENUE_CALLS = 6;

export type GroundInput = LaunchGroundInput<ShowsRead, ShowsQueryPlan>;

const VOICE: Voice = {
  audience: "the act's audience",
  yourAudience: "your act's audience",
  theseComps: 'this act',
  compsVerdict: {
    holds: 'Your act and its comparable acts point to one audience.',
    weak: 'Your act and its comparable acts lean on one name for the result, so another comparable act of your own would firm it up.',
    breaks: 'Your act and its comparable acts point to different audiences.',
    cant: 'Your act and its comparable acts could not be compared as one audience.',
  },
};

const labels = (): BriefLabels => ({
  marketNoun: 'act',
  compsClaim: 'The act and its comparable acts describe one audience',
  sales: {
    item: 'Ticket sales and revenue',
    reason: 'Qloo has taste data, not ticket sales. Add your own numbers when you fix a plan.',
  },
});

/**
 * Stage 1 (spec §4.6). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 */
export function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  return groundLaunch(deps, input, {
    voice: VOICE,
    labels,
    queryOrder: showsPlan.showsQueryKeys,
    runQueries,
  } satisfies GroundSpec<ShowsRead, ShowsQueryPlan>);
}

async function runQueries(kit: GroundKit<ShowsRead, ShowsQueryPlan>): Promise<void> {
  const { deps, read, plan, gaps, want, jobs, taste } = kit;
  const agesText = read.ages.length ? ` ${agesPhrase(read.ages)}` : '';
  const crowd = VOICE.audience;
  const tags = await resolve(deps, plan, want);

  if (want('similar')) {
    const scene = tags.similar;
    if (!scene) {
      gaps.push({
        item: 'Acts that audience plays',
        why: plan.scene
          ? `Qloo has no music tag for "${plan.scene}", so artists were not asked: without a scene the list drifts to what is popular overall.`
          : 'No music scene fits this kind of show, so artists were not asked: without a scene the list drifts to what is popular overall.',
      });
    } else {
      for (const city of plan.similarCities.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'similar',
            `Acts that audience plays in ${city}`,
            `f-similar-${slug(city)}`,
            { type: 'urn:entity:artist', tags: [scene.id], city, ages: read.ages },
            (names) =>
              `In ${city}, the ${scene.name} artists that rank highest with ${crowd}${agesText} are ${names}.`,
            { city, tags: [scene.name], ages: read.ages },
          ),
        );
      }
    }
  }

  if (want('brands')) {
    // The biggest brands would never sponsor a single show. So the model names brands that could,
    // Qloo finds them, and Qloo ranks only those.
    const pools = await brandPools(kit, tags.brands, plan.brandCities);
    if (pools.length > 0) {
      for (const { city, pool } of pools.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'brands',
            `Sponsor brands in ${city}`,
            `f-brands-${slug(city)}`,
            { type: 'urn:entity:brand', city, only: pool },
            (names) =>
              `In ${city}, among brands that could realistically sponsor a show like this, ${crowd} likes ${names} best.`,
            { city },
          ),
        );
      }
    } else {
      const pairs = tags.brands.flatMap((tag) => plan.brandCities.map((city) => ({ tag, city })));
      for (const { tag, city } of pairs.slice(0, MAX_BRAND_CALLS)) {
        jobs.push(
          taste(
            'brands',
            `${capitalise(tag.name)} brands in ${city}`,
            `f-brands-${slug(tag.name)}-${slug(city)}`,
            { type: 'urn:entity:brand', tags: [tag.id], city, popularity: BRAND_BAND },
            (names) =>
              `In ${city}, the mid-size ${tag.name.toLowerCase()} brands that rank highest with ${crowd} are ${names}.`,
            { city, tags: [tag.name] },
          ),
        );
      }
      if (tags.brands.length === 0) {
        gaps.push({
          item: 'Sponsor brands',
          why: 'Qloo had no brand category for the ones asked.',
        });
      }
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
          `The ${genre ? `${genre.name.toLowerCase()} ` : ''}podcasts that rank highest with ${crowd}${city ? ` in ${city}` : ''} are ${names}.`,
        { city, tags: genre ? [genre.name] : [] },
      ),
    );
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
            `In ${city}, the ${plural(tag.name)} that rank highest with ${crowd} are ${names}.`,
          { city, tags: [tag.name] },
        ),
      );
    }
    if (tags.venues.length === 0) {
      gaps.push({
        item: 'Venues',
        why: 'Qloo has no place category for this kind of show, so venues were not asked.',
      });
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
  plan: ShowsQueryPlan,
  want: (key: string) => boolean,
): Promise<{ similar: Tag | null; podcasts: Tag | null; brands: Tag[]; venues: Tag[] }> {
  type Ask = { phrase: string; space: keyof typeof TAG_SPACES };
  const asks: Ask[] = [
    ...(want('similar') && plan.scene ? [{ phrase: plan.scene, space: 'similar' as const }] : []),
    ...(want('podcasts') && plan.podcastGenre
      ? [{ phrase: plan.podcastGenre, space: 'podcasts' as const }]
      : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
    ...(want('venues')
      ? plan.venuePlaces.slice(0, 2).map((phrase) => ({ phrase, space: 'venues' as const }))
      : []),
  ];
  const empty = { similar: null, podcasts: null, brands: [], venues: [] };
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
    similar: of('similar')[0] ?? null,
    podcasts: of('podcasts')[0] ?? null,
    brands: of('brands'),
    venues: of('venues'),
  };
}
