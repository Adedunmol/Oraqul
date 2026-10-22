import {
  findTasteOutputSchema,
  gameProfilesOutputSchema,
  normalizeTitle,
  overlapFromAffinity,
  platformVerdict,
  resolveTagsOutputSchema,
  scoreRivalsOutputSchema,
  searchEntityOutputSchema,
  storeTagVerdict,
  themeTagsOutputSchema,
  tools,
} from '@oraqul/engine';
import { gamesPlan } from '@oraqul/packs';
import type { FanBase, FanMedium } from '@oraqul/schema';
import type { BriefLabels } from '../launch/brief.js';
import { slug } from '../launch/brief.js';
import {
  agesPhrase,
  BRAND_BAND,
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
import type { GamesQueryPlan } from './planner.js';
import { gamesWithTags, matchTags, platformShares, sharedTags, topPlatforms } from './profile.js';
import type { GamesRead } from './read.js';
import { regionCities } from './regions.js';

export type { GroundDeps, Grounded } from '../launch/findings.js';

const {
  CREATORS_GROUNDED,
  FAN_BASES_PER_MEDIUM,
  FAN_MEDIA,
  MAX_CITIES_PER_QUERY,
  PLATFORM_LABEL,
  TAG_SPACES,
} = gamesPlan;

// Most calls the brand and community queries make between them, so they cannot spend the run.
const MAX_BRAND_CALLS = 4;
const MAX_COMMUNITY_CALLS = 8;
// Candidates the discovery call finds per fan base, scored together with the collabs.
const DISCOVERED = 4;

export type GroundInput = LaunchGroundInput<GamesRead, GamesQueryPlan>;

const compsVerdict: Voice['compsVerdict'] = {
  holds: 'Your game and its comparable games point to one audience.',
  weak: 'Your game and its comparable games lean on one title for the result, so another comp of your own would firm it up.',
  breaks: 'Your game and its comparable games point to different audiences.',
  cant: 'Your game and its comparable games could not be compared as one audience.',
};

/** When the team named no region, the regions are the kind's usual markets and the text says so. */
const voiceFor = (read: GamesRead): Voice => ({
  audience: "the game's audience",
  yourAudience: "your game's audience",
  theseComps: 'this game',
  compsVerdict,
  yourPlaces:
    read.places.length || read.regions.length
      ? 'your regions'
      : 'the regions a launch like this usually checks',
});

const labels = (): BriefLabels => ({
  marketNoun: 'game',
  compsClaim: 'The game and its comparable games describe one audience',
  sales: {
    item: 'Wishlists, sales, player counts and reviews',
    reason: 'Qloo has taste data, not sales. Add your own numbers when you fix a plan.',
  },
});

/**
 * Stage 1 (spec §4.3). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 * TODO(verify): a game as the signal for every kind of media, the heatmap and the theme tags, with
 * `qloo-games-probes.ts`. Until docs/backend/qloo.md says so, none of these is verified for Games.
 */
export function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  return groundLaunch(deps, input, {
    voice: voiceFor(input.read),
    labels,
    queryOrder: gamesPlan.gamesQueryKeys,
    runQueries,
    // With no region named, the kind's usual markets are ranked as the plan's regions.
    standInPlaces: (_read, plan) => plan.worthALook,
  } satisfies GroundSpec<GamesRead, GamesQueryPlan>);
}

async function runQueries(kit: GroundKit<GamesRead, GamesQueryPlan>): Promise<void> {
  const { deps, read, plan, gaps, want, jobs, taste } = kit;
  const agesText = read.ages.length ? ` ${agesPhrase(read.ages)}` : '';
  const crowd = "your game's players";
  const tags = await resolve(deps, plan, want);

  // A region word with no cities in Qloo's table cannot be ranked, so the plan says so.
  for (const region of read.regions) {
    if (regionCities([region]).length === 0) {
      gaps.push({
        item: `Region: ${region}`,
        why: 'The city table has no cities for this region, so it was not ranked.',
      });
    }
  }

  if (want('profile')) await profile(kit);

  if (want('tags')) {
    const run = await kit.safely('Themes of your comparable games', () =>
      tools.themeTags.run(deps.tools, {
        entityIds: kit.ids,
        kinds: ['theme', 'audience'],
      }),
    );
    if (run) {
      const out = themeTagsOutputSchema.parse(run.data);
      const wording: Record<string, (names: string) => string> = {
        theme: (names) => `Your comparable games share the themes ${names}.`,
        audience: (names) => `The traits that describe their players are ${names}.`,
      };
      out.kinds.forEach((k, i) => {
        const call = run.receipts[i];
        if (!call || k.tags.length === 0) {
          gaps.push({
            item: `Game ${k.kind}s`,
            why: 'Qloo returned none for the comparable games.',
          });
          return;
        }
        kit.add(
          {
            id: `f-tags-${k.kind}`,
            query: 'tags',
            text: (wording[k.kind] ?? ((n) => n))(
              list(k.tags.slice(0, 4).map((t) => t.name.toLowerCase())),
            ),
            entities: k.tags.map((t) => entity(t.name, t.affinity, null)),
            verdict: null,
            confidence: out.confidence,
            why: out.why,
          },
          call,
        );
      });
    }
  }

  if (want('fanbase')) jobs.push(fanBases(kit, tags));

  if (want('brands')) {
    // The brands Qloo likes best are the biggest names, which would never say yes to an
    // independent studio. So the model names brands that could, Qloo finds them, and Qloo ranks
    // only those.
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
              `In ${city}, among brands that could realistically partner with an independent studio, ${crowd} like ${names} best.`,
            { city },
          ),
        );
      }
    } else {
      // No usable candidates: ask Qloo by category, in each named city or once with no city.
      const where = plan.brandCities.length ? plan.brandCities : [null];
      const pairs = tags.brands.flatMap((tag) => where.map((city) => ({ tag, city })));
      for (const { tag, city } of pairs.slice(0, MAX_BRAND_CALLS)) {
        jobs.push(
          taste(
            'brands',
            `${capitalise(tag.name)} brands${city ? ` in ${city}` : ''}`,
            `f-brands-${slug(tag.name)}${city ? `-${slug(city)}` : ''}`,
            { type: 'urn:entity:brand', tags: [tag.id], city, popularity: BRAND_BAND },
            (names) =>
              `${city ? `In ${city}, the` : 'The'} mid-size ${tag.name.toLowerCase()} brands that rank highest with ${crowd} are ${names}.`,
            { city: city ?? null, tags: [tag.name] },
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

  if (want('podcasts')) {
    const genre = tags.podcasts;
    const city = plan.podcastCity;
    if (!genre) {
      gaps.push({
        item: 'Press and podcasts',
        why: 'Qloo has no gaming podcast tag, so podcasts were not asked: without one the list drifts to what is popular overall.',
      });
    } else {
      jobs.push(
        taste(
          'podcasts',
          'Podcasts',
          'f-podcasts',
          {
            type: 'urn:entity:podcast',
            tags: [genre.id],
            city,
            ages: read.ages,
          },
          (names) =>
            `The ${genre.name.toLowerCase()} podcasts that rank highest with ${crowd}${agesText}${city ? ` in ${city}` : ''} are ${names}.`,
          { city, tags: [genre.name], ages: read.ages },
        ),
      );
    }
  }

  if (want('creators')) {
    if (CREATORS_GROUNDED) {
      jobs.push(
        taste(
          'creators',
          'Creators',
          'f-creators',
          { type: 'urn:entity:person', ages: read.ages },
          (names) => `The creators that rank highest with ${crowd}${agesText} are ${names}.`,
          { ages: read.ages },
        ),
      );
    } else {
      gaps.push({
        item: 'Creators and streamers',
        why: 'Qloo has no verified creator data, so creators are planned from launch practice and not measured.',
      });
    }
  }

  if (want('community')) {
    const where = plan.communityCities.length ? plan.communityCities : [null];
    const pairs = tags.community.flatMap((tag) => where.map((city) => ({ tag, city })));
    for (const { tag, city } of pairs.slice(0, MAX_COMMUNITY_CALLS)) {
      if (!city) continue;
      jobs.push(
        taste(
          'community',
          `${capitalise(plural(tag.name))} in ${city}`,
          `f-community-${slug(tag.name)}-${slug(city)}`,
          { type: 'urn:entity:place', tags: [tag.id], city },
          (names) =>
            `In ${city}, the ${plural(tag.name)} that rank highest with ${crowd} are ${names}.`,
          { city, tags: [tag.name] },
        ),
      );
    }
  }
}

/**
 * What Qloo holds about the comparable games: where they live and what they are tagged. The team's
 * platforms and store tags are tested against it as assumptions of their own (spec §5.6), so the
 * Assumptions tab and an audit test them like the age band.
 */
async function profile(kit: GroundKit<GamesRead, GamesQueryPlan>): Promise<void> {
  const { deps, read, brief, gaps } = kit;
  const run = await kit.safely('Your comparable games', () =>
    tools.gameProfiles.run(deps.tools, { entityIds: kit.ids.slice(0, 20) }),
  );
  if (!run) return;
  const out = gameProfilesOutputSchema.parse(run.data);
  const [call] = run.receipts;
  if (!call || out.confidence === 'lower' || out.games.length === 0) {
    gaps.push({
      item: 'Platforms and tags of your comparable games',
      why: 'Qloo held no platforms or tags for them.',
    });
    return;
  }

  const top = topPlatforms(out.games);
  const shared = sharedTags(out.games);
  const withTags = gamesWithTags(out.games);
  if (top.length || shared.length) {
    const parts = [
      top.length
        ? `Your comparable games are mostly on ${list(top.map((p) => PLATFORM_LABEL[p]))}.`
        : '',
      shared.length ? `Most of them carry the tags ${list(shared.slice(0, 5))}.` : '',
    ].filter(Boolean);
    kit.add(
      {
        id: 'f-profile',
        query: 'profile',
        text: parts.join(' '),
        entities: [
          ...top.map((p) => entity(PLATFORM_LABEL[p], null, 'platform')),
          ...shared.slice(0, 8).map((t) => entity(t, null, 'tag')),
        ],
        numbers: {
          'comparable games': out.games.length,
          'with tags': withTags,
        },
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      call,
    );
  }

  const assumption = (
    id: string,
    text: string,
    result: ReturnType<typeof platformVerdict>,
    fix: string,
    sentence: string,
  ) => {
    brief.brief.assumptions.push({
      id,
      text,
      verdict: result.verdict,
      why: result.why,
      fix: result.verdict === 'holds' ? '' : fix,
      unstated: false,
    });
    const cant = result.verdict === 'cant';
    brief.lineReceipts.push({
      ...call,
      lineId: id,
      rule: cant ? `Could not test: ${result.why}` : `${result.why} Confidence ${out.why}.`,
      confidence: cant ? 'lower' : out.confidence,
    });
    brief.reasons.set(id, cant ? 'lower: this line could not be tested' : out.why);
    if (result.verdict === 'weak' || result.verdict === 'breaks') {
      brief.brief.risks.push({
        id: `risk-${id}`,
        text,
        signal: result.why,
        action: fix,
      });
    }
    kit.add(
      {
        id: `f-${id}`,
        query: 'profile',
        text: sentence,
        entities: [],
        verdict: result.verdict,
        confidence: cant ? 'lower' : out.confidence,
        why: cant ? 'lower: this line could not be tested' : out.why,
      },
      call,
    );
  };

  if (read.platforms.length) {
    const named = list(read.platforms.map((p) => PLATFORM_LABEL[p]));
    const result = platformVerdict(platformShares(out.games, read.platforms));
    const strongest = top.filter((p) => !read.platforms.includes(p))[0];
    assumption(
      'a-platform',
      `${named} ${read.platforms.length > 1 ? 'are' : 'is'} where your comparable games live`,
      result,
      strongest
        ? `Keep ${named}, and look at ${PLATFORM_LABEL[strongest]} too: more of your comparable games are there.`
        : `Keep ${named}, and check that your store page names every platform you ship on.`,
      {
        holds: `Your comparable games are on ${named} too.`,
        weak: `Some of your comparable games skip ${named}, so those players may find the game elsewhere.`,
        breaks: `Few of your comparable games are on ${named}.`,
        cant: `The platforms of your comparable games could not be compared with ${named}.`,
      }[result.verdict],
    );
  }

  if (read.storeTags.length) {
    const matched = matchTags(read.storeTags, shared);
    const result = storeTagVerdict(matched.length, shared.length, withTags);
    assumption(
      'a-store-tags',
      `The store tags ${list(read.storeTags)} fit your comparable games`,
      result,
      shared.length
        ? `Keep your tags, and add ${list(shared.filter((s) => !matched.some((m) => m.toLowerCase() === s.toLowerCase())).slice(0, 3))}, which most of your comparable games carry.`
        : '',
      {
        holds: `Your store tags match what your comparable games are tagged with.`,
        weak: `Your store tags barely overlap with the tags your comparable games share.`,
        breaks: `Your store tags do not match your comparable games.`,
        cant: `Your store tags could not be compared with your comparable games.`,
      }[result.verdict],
    );
  }
}

/** The word for each fan base in a sentence about its members. */
const NOUN: Record<FanMedium, string> = {
  music: 'artists',
  series: 'series',
  anime: 'anime series',
  film: 'films',
  brand: 'brands',
  podcast: 'podcasts',
  game: 'other games',
};

interface Collab {
  name: string;
  entityId: string;
  medium: FanMedium;
}

/**
 * The Fan base bridge (spec §4.3, §5): for each medium, who ranks highest with the game's
 * players, with any collab the team named scored in the same call. Overlap compares only within a
 * medium, because Qloo scores one entity type per call, so the rows are grouped, never ranked
 * across media.
 */
async function fanBases(
  kit: GroundKit<GamesRead, GamesQueryPlan>,
  tags: Awaited<ReturnType<typeof resolve>>,
): Promise<void> {
  const { deps, read, plan, gaps, brief } = kit;
  const collabs = await resolveCollabs(kit);
  const rows: FanBase[] = [];
  // Anime is a kind of series. It goes first so the series list does not repeat it.
  const animeIds = new Set<string>();
  const order = [...FAN_MEDIA].sort(
    (a, b) => Number(b.medium === 'anime') - Number(a.medium === 'anime'),
  );

  for (const spec of order.filter((m) => plan.fanMedia.includes(m.medium))) {
    const noun = NOUN[spec.medium];
    const tag = spec.space ? tags.fan[spec.medium] : null;
    if (spec.phrase && !tag) {
      gaps.push({
        item: capitalise(noun),
        why: `Qloo has no "${spec.phrase}" tag, so ${noun} were not asked: without one the list drifts to what is popular overall.`,
      });
      continue;
    }
    const found = await kit.safely(capitalise(noun), () =>
      tools.findTaste.run(deps.tools, {
        entityIds: kit.ids,
        type: spec.type,
        tags: tag ? [tag.id] : [],
        ages: read.ages,
        take: DISCOVERED,
        exclude: spec.medium === 'series' ? [...animeIds] : [],
      }),
    );
    if (!found) continue;
    const discovered = findTasteOutputSchema.parse(found.data).candidates;
    const mine = collabs.filter((c) => c.medium === spec.medium);
    const ids = [
      ...new Set([...discovered.map((c) => c.entityId), ...mine.map((c) => c.entityId)]),
    ];
    if (ids.length === 0) {
      gaps.push({
        item: capitalise(noun),
        why: 'Qloo returned nothing for this audience.',
      });
      continue;
    }

    // Qloo gives the same affinity open as scored (probed live), so discovery alone ranks what the
    // audience follows. A scoring call is only for a collab, which discovery would not list; it
    // runs once per medium so the collab and the rest are comparable.
    let ranked: { entityId: string; name: string; overlap: number | null }[];
    let out: { confidence: 'high' | 'medium' | 'lower'; why: string };
    let call: Awaited<ReturnType<typeof tools.findTaste.run>>['receipts'][number] | undefined;
    if (mine.length === 0) {
      ranked = discovered
        .filter((c) => c.affinity !== null)
        .map((c) => ({
          entityId: c.entityId,
          name: c.name,
          overlap: overlapFromAffinity(c.affinity ?? 0),
        }))
        .sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));
      out = {
        confidence: findTasteOutputSchema.parse(found.data).confidence,
        why: findTasteOutputSchema.parse(found.data).why,
      };
      call = found.receipts[0];
    } else {
      const scored = await kit.safely(capitalise(noun), () =>
        tools.scoreRivals.run(deps.tools, {
          entityIds: kit.ids,
          type: spec.type,
          rivals: ids.slice(0, 12),
          leaveOneOut: false,
        }),
      );
      if (!scored) continue;
      const parsed = scoreRivalsOutputSchema.parse(scored.data);
      ranked = parsed.rivals
        .filter((r) => r.overlap !== null)
        .sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));
      // No leave one out here (it would cost a rerun per anchor per medium), so a high result is
      // not shown as checked.
      out =
        parsed.confidence === 'high'
          ? {
              confidence: 'medium',
              why: 'medium: the result was not checked with each anchor left out',
            }
          : { confidence: parsed.confidence, why: parsed.why };
      call = scored.receipts[0];
    }
    if (!call || ranked.length === 0) {
      gaps.push({
        item: capitalise(noun),
        why: 'Qloo did not score these for this audience.',
      });
      continue;
    }

    const isCollab = (id: string) => mine.some((c) => c.entityId === id);
    const kept = [
      ...ranked.filter((r) => !isCollab(r.entityId)).slice(0, FAN_BASES_PER_MEDIUM),
      ...ranked.filter((r) => isCollab(r.entityId)),
    ].sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));

    for (const r of kept) {
      const id = `fan-${spec.medium}-${slug(r.name)}`;
      const overlap = r.overlap ?? 0;
      const collab = isCollab(r.entityId);
      rows.push({
        id,
        name: r.name,
        medium: spec.medium,
        // Qloo scores each entity once, so a collab shows as a ranked row. It does not move.
        before: overlap,
        after: overlap,
        evidence: `${capitalise(noun)} · ${overlap} of 100 overlap with your players`,
        ...(collab ? { note: 'Your collab' } : {}),
      });
      brief.lineReceipts.push({
        ...call,
        lineId: id,
        rule: `Overlap is the affinity Qloo gives ${r.name} for these players × 100, scored with the other ${noun} in one call, so it compares only within ${noun}. Confidence ${out.why}.`,
        confidence: out.confidence,
      });
      brief.reasons.set(id, out.why);
    }

    if (spec.medium === 'anime') for (const r of kept) animeIds.add(r.entityId);
    const top = kept.filter((r) => !isCollab(r.entityId));
    kit.add(
      {
        id: `f-fan-${spec.medium}`,
        query: 'fanbase',
        text: `The ${noun} that rank highest with your game's players are ${list(top.slice(0, 3).map((r) => r.name))}.`,
        entities: ranked.map((r) => entity(r.name, (r.overlap ?? 0) / 100, spec.label, r.entityId)),
        numbers: Object.fromEntries(ranked.map((r) => [`overlap ${r.name}`, r.overlap ?? 0])),
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      call,
    );

    for (const c of mine) {
      const place = ranked.findIndex((r) => r.entityId === c.entityId);
      if (place === -1) {
        gaps.push({
          item: `Collab with ${c.name}`,
          why: 'Qloo did not score it for this audience.',
        });
        continue;
      }
      kit.add(
        {
          id: `f-fan-collab-${slug(c.name)}`,
          query: 'fanbase',
          // Two or three scores do not make a ranking, so a small group reports the overlap.
          text:
            ranked.length >= 3
              ? `${c.name} ranks ${place + 1} of ${ranked.length} among the ${noun} asked about for your game's players.`
              : `${c.name} overlaps ${ranked[place]?.overlap ?? 0} of 100 with your game's players, scored with ${ranked.length - 1} other ${noun}.`,
          entities: [entity(c.name, (ranked[place]?.overlap ?? 0) / 100, spec.label, c.entityId)],
          numbers: { place: place + 1, of: ranked.length },
          verdict: null,
          confidence: out.confidence,
          why: out.why,
        },
        call,
      );
    }
  }

  // Grouped by medium in the catalog's order, best first inside each.
  const rank = (m: FanMedium | undefined) => FAN_MEDIA.findIndex((x) => x.medium === m);
  brief.brief.fan = rows.sort((a, b) => rank(a.medium) - rank(b.medium) || b.after - a.after);
}

/** Finds each collab the team named in Qloo, and the medium it belongs to by its entity type. */
async function resolveCollabs(kit: GroundKit<GamesRead, GamesQueryPlan>): Promise<Collab[]> {
  const types = [...new Set(FAN_MEDIA.map((m) => m.type))];
  const found = await Promise.all(
    kit.read.collabs.slice(0, 4).map(async (name) => {
      const run = await kit.safely(`Collab with ${name}`, () =>
        tools.searchEntity.run(kit.deps.tools, { name, types }),
      );
      if (!run) return null;
      const top = searchEntityOutputSchema
        .parse(run.data)
        .candidates.filter((c) => normalizeTitle(c.name) === normalizeTitle(name));
      // Several exact matches (a film and a series with one name) are ambiguous: not guessed.
      const only = top.length === 1 ? top[0] : undefined;
      const type = only?.types.find((t) => FAN_MEDIA.some((m) => m.type === t));
      const medium = FAN_MEDIA.find((m) => m.type === type)?.medium;
      if (!only || !medium) {
        kit.gaps.push({
          item: `Collab with ${name}`,
          why:
            top.length > 1
              ? 'Several titles share this name, so none was chosen.'
              : 'Qloo did not find it by name.',
        });
        return null;
      }
      return { name, entityId: only.entityId, medium } satisfies Collab;
    }),
  );
  return found.flatMap((c) => c ?? []);
}

interface Tag {
  id: string;
  name: string;
}

// Every phrase the plan needs, resolved to Qloo tags in one tool run. Unmatched ones drop out.
async function resolve(
  deps: GroundDeps,
  plan: GamesQueryPlan,
  want: (key: string) => boolean,
): Promise<{
  podcasts: Tag | null;
  fan: Partial<Record<FanMedium, Tag>>;
  brands: Tag[];
  community: Tag[];
}> {
  type Ask = {
    phrase: string;
    space: keyof typeof TAG_SPACES;
    medium?: FanMedium;
  };
  const fanAsks: Ask[] = want('fanbase')
    ? FAN_MEDIA.flatMap((m) =>
        plan.fanMedia.includes(m.medium) && m.phrase && m.space
          ? [
              {
                phrase: m.medium === 'podcast' && plan.podcastGenre ? plan.podcastGenre : m.phrase,
                space: m.space,
                medium: m.medium,
              },
            ]
          : [],
      )
    : [];
  const asks: Ask[] = [
    ...fanAsks,
    ...(want('podcasts') && plan.podcastGenre
      ? [{ phrase: plan.podcastGenre, space: 'podcasts' as const }]
      : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
    ...(want('community')
      ? plan.communityPlaces.slice(0, 2).map((phrase) => ({ phrase, space: 'community' as const }))
      : []),
  ];
  const empty = { podcasts: null, fan: {}, brands: [], community: [] };
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
    asks.flatMap((a, i) => (a.space === space && !a.medium ? (tagFor(i) ?? []) : []));
  const fan: Partial<Record<FanMedium, Tag>> = {};
  asks.forEach((a, i) => {
    const tag = tagFor(i);
    if (a.medium && tag) fan[a.medium] = tag;
  });
  return {
    podcasts: of('podcasts')[0] ?? null,
    fan,
    brands: of('brands'),
    community: of('community'),
  };
}
