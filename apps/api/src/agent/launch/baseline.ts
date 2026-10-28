import { insights, QlooBudgetError, QlooError, type ToolContext, toReceipt } from '@oraqul/engine';
import type { QlooEntityType, Receipt } from '@oraqul/schema';

// What a partner's fit is scored against: the brands, podcasts or books Qloo lists most for a city
// with no comps behind them, so a partner brief can say how much more this audience likes it than
// the names that city already likes. It is a measuring stick for confidence, never how partners
// are picked (spec §5.2: lift over a mass-market baseline rewards anything niche). A list for a
// place is not a list of the biggest names, so it reads as "the favourites in {city}".

/** A baseline needs at least this many names to be a stick worth measuring against. */
export const MIN_BASELINE = 2;
const TAKE = 8;
const KEEP = 4;
/** Below this, Qloo's own popularity says the name is too obscure to stand for a city's favourites. */
const MIN_POPULARITY = 0.7;

// The same city asks Qloo the same thing every run, so each list is fetched once per process.
const baselineCache = new Map<string, { entityId: string; name: string }[]>();

type BaselineType = Extract<
  QlooEntityType,
  'urn:entity:brand' | 'urn:entity:podcast' | 'urn:entity:book'
>;

export async function marketBaseline(
  ctx: ToolContext,
  keep: (made: Receipt[]) => void,
  type: BaselineType,
  city: string,
): Promise<{ entityId: string; name: string }[]> {
  const key = `${ctx.source}:${type}:${city.trim().toLowerCase()}`;
  const hit = baselineCache.get(key);
  if (hit) return hit;
  try {
    const shape = {
      take: TAKE,
      'signal.location.query': city,
      'filter.popularity.min': MIN_POPULARITY,
    };
    // `filter.type` picks which parameters Qloo accepts, so each type is its own request.
    const made = await insights.entities(
      ctx.qloo,
      type === 'urn:entity:brand'
        ? { ...shape, 'filter.type': 'urn:entity:brand' }
        : type === 'urn:entity:podcast'
          ? { ...shape, 'filter.type': 'urn:entity:podcast' }
          : { ...shape, 'filter.type': 'urn:entity:book' },
    );
    const found = made.data.results.entities
      .filter((e) => (e.popularity ?? 0) >= MIN_POPULARITY)
      .slice(0, KEEP)
      .map((e) => ({ entityId: e.entity_id, name: e.name }));
    keep([
      toReceipt(made.call, {
        returned: { candidates: found },
        rule: `The ${type.split(':').pop()}s Qloo lists most for ${city}, with no comps behind them, in Qloo's order. A partner is scored against these in one call. Confidence lower.`,
        confidence: 'lower',
        source: ctx.source,
      }),
    ]);
    baselineCache.set(key, found);
    return found;
  } catch (err) {
    if (err instanceof QlooBudgetError || !(err instanceof QlooError)) throw err;
    return [];
  }
}

/** Forgets the baseline lists, so a recorded run captures them again. Tests only. */
export function clearBaselineCache(): void {
  baselineCache.clear();
}
