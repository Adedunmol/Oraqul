import { findTasteOutputSchema, tools } from '@oraqul/engine';
import { slug } from './brief.js';
import {
  agesPhrase,
  BRAND_BAND,
  brandPool,
  entity,
  type GroundKit,
  KEEP,
  list,
  NAMED,
} from './findings.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';

/** Cities brands are looked for in a category, first the home market. */
export const BRAND_DISCOVERY_CITIES = 2;

/** Calls that must be left before a thin city is searched wider, so a plan stays in its budget. */
const WIDEN_MIN_CALLS = 12;

/** The most brands Qloo ranks in one call (`findTaste` takes ten). */
export const POOL_CAP = 10;

/** A brand category tag, as the category's tag lookup returns it. */
export interface BrandTag {
  id: string;
  name: string;
}

/**
 * The brands Qloo ranks for each city: the ones the team and the model named, and the brands Qloo finds among the verified categories for the comps' audience (so a
 * soft drink the audience likes can be a partner without anyone having guessed it). A mid-size
 * band is always asked; the biggest names only when who is launching can realistically approach
 * one (`plan.reach`). Everything found joins one pool, and one call ranks it (qloo.md: rank a list
 * we choose, never an open one). Cities with fewer than two brands are left out.
 */
export async function brandPools<R extends LaunchRead, P extends QueryPlanCore>(
  kit: GroundKit<R, P>,
  tags: BrandTag[],
  cities: string[] = [],
): Promise<{ city: string; pool: string[] }[]> {
  const { deps, plan } = kit;
  const named = new Map<string, string[]>();
  await Promise.all(
    plan.brandCandidates.map(async ({ city, names }) => {
      named.set(city, await brandPool(deps, names));
    }),
  );

  const asked = [...new Set([...plan.brandCandidates.map((c) => c.city), ...cities])];
  const found = new Map<string, string[]>();
  if (kit.ids.length > 0 && tags.length > 0) {
    const flagship = plan.reach?.flagship ?? false;
    const where = asked.slice(0, BRAND_DISCOVERY_CITIES);
    const asks = where.flatMap((city, at) =>
      tags
        .slice(0, 2)
        .flatMap((tag) => [
          { city, tag, band: BRAND_BAND as { min: number; max: number } | null },
          ...(flagship && at === 0 ? [{ city, tag, band: null }] : []),
        ]),
    );
    // Merged in the order asked, so the pool and the ranking request are the same on every run.
    const results = await Promise.all(asks.map((a) => discover(kit, a.tag, a.city, a.band)));
    asks.forEach((a, i) => {
      found.set(a.city, [...(found.get(a.city) ?? []), ...(results[i] ?? [])]);
    });
  }

  // A city with fewer than three brands cannot be given a verdict, and the team still needs options.
  // Look wider for it: one more category read with no popularity band, kept inside the call budget.
  const thin = asked.filter((c) => (named.get(c)?.length ?? 0) + (found.get(c)?.length ?? 0) < 3);
  const tag = tags[0];
  if (
    tag &&
    kit.ids.length > 0 &&
    thin.length > 0 &&
    kit.deps.tools.qloo.callsLeft >= WIDEN_MIN_CALLS
  ) {
    const wider = await Promise.all(thin.map((city) => discover(kit, tag, city, null, 3)));
    thin.forEach((city, i) => {
      found.set(city, [...(found.get(city) ?? []), ...(wider[i] ?? [])]);
    });
  }

  const pools = asked.map((city) => ({
    city,
    pool: [...new Set([...(named.get(city) ?? []), ...(found.get(city) ?? [])])].slice(0, POOL_CAP),
  }));
  const usable = pools.filter((p) => p.pool.length >= 2);
  // Each brand is also ranked for the city and age band alone. The comps' audience likes the biggest
  // names everywhere, so this is what says a brand is liked by this audience and not by everyone.
  if (kit.read.ages.length > 0) {
    for (const p of usable.slice(0, 2)) kit.jobs.push(cityCheck(kit, p.city, p.pool));
  }
  return usable;
}

/** One category's brands for the comps' audience in a city, kept for the pool. */
async function discover<R extends LaunchRead, P extends QueryPlanCore>(
  kit: GroundKit<R, P>,
  tag: BrandTag,
  city: string,
  band: { min: number; max: number } | null,
  take = band ? 3 : 2,
): Promise<string[]> {
  const run = await kit.safely(`${tag.name} brands in ${city}`, () =>
    tools.findTaste.run(kit.deps.tools, {
      entityIds: kit.ids,
      type: 'urn:entity:brand',
      tags: [tag.id],
      city,
      popularity: band,
      take,
    }),
  );
  if (!run) return [];
  return findTasteOutputSchema.parse(run.data).candidates.map((c) => c.entityId);
}

/** The same brands ranked for the city and age band with no comps, as a finding of its own. */
async function cityCheck<R extends LaunchRead, P extends QueryPlanCore>(
  kit: GroundKit<R, P>,
  city: string,
  pool: string[],
): Promise<void> {
  const { read } = kit;
  const age = agesPhrase(read.ages);
  const run = await kit.safely(`How ${city} ranks the same brands`, () =>
    tools.findTaste.run(kit.deps.tools, {
      type: 'urn:entity:brand',
      city,
      ages: read.ages,
      only: pool,
      take: Math.min(Math.max(KEEP, pool.length), POOL_CAP),
    }),
  );
  if (!run) return;
  const out = findTasteOutputSchema.parse(run.data);
  const [call] = run.receipts;
  if (!call || out.candidates.length < 3) return;
  kit.add(
    {
      id: `f-brands-city-${slug(city)}`,
      query: 'brands-city',
      text: `Among the same brands, people ${age} in ${city} overall like ${list(out.candidates.slice(0, NAMED).map((c) => c.name))} best. This is taste for the place, not for your comps.`,
      entities: out.candidates.map((c) =>
        entity(c.name, c.affinity, c.detail, c.entityId, c.popularity),
      ),
      verdict: null,
      confidence: 'lower',
      why: 'lower: it rests on the place and age band alone, with no comps behind it',
      context: { city, ages: read.ages, audience: 'region and age only' },
    },
    call,
  );
}
