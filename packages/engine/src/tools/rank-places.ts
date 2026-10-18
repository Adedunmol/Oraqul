import { z } from 'zod';
import { type ConfidenceResult, confidenceFor, countKnown, MIN_PLACE_CELLS } from '../confidence';
import { type CityBox, cityBox, inBox, multiPolygon } from '../places';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { isNearEdge, lift, liftBand } from '../scoring';
import { leaveOneOut, nameOf } from './leave-one-out';
import { defineTool } from './tool';

const RANK_RULE =
  'Each city is the mean affinity of the heatmap cells inside its box, all from one call so they compare. A city with fewer than 25 cells is not ranked.';

export const rankPlacesOutputSchema = z.object({
  places: z.array(
    z.object({
      place: z.string(),
      status: z.enum(['ranked', 'not_ranked', 'unknown_place']),
      /** 1 is the strongest. Null when not ranked. */
      rank: z.number().int().nullable(),
      affinity: z.number().nullable(),
      /** Spec §5.2: affinity over the mean of every ranked city in the call. Null when not ranked. */
      lift: z.number().nullable(),
      band: z.enum(['strong', 'usable', 'weak']).nullable(),
      cells: z.number().int(),
      confidence: z.enum(['high', 'medium', 'lower']),
      why: z.string(),
    }),
  ),
  /**
   * Neighbourhoods read from the same heatmap, strongest first within each city. An area with too
   * few cells near it has no reading and is left out.
   */
  areas: z
    .array(
      z.object({
        city: z.string(),
        name: z.string(),
        /** Mean affinity of the cells nearest the area's centre. */
        affinity: z.number(),
        /** That affinity over the city's own mean in the same call: above 1.0 beats the city. */
        lift: z.number().nullable(),
        cells: z.number().int(),
        /** 1 is the strongest in its city. */
        rank: z.number().int(),
      }),
    )
    .default([]),
  /** The call every ranked place cites. Null when no place was in the city table. */
  receiptId: z.string().nullable(),
  /** Whether the city order held with each anchor left out. Null when the check did not run. */
  leaveOneOut: z
    .discriminatedUnion('result', [
      z.object({ result: z.literal('holds') }),
      z.object({ result: z.literal('changes'), restsOn: z.string() }),
      z.object({ result: z.literal('skipped') }),
    ])
    .nullable(),
});

type Scored = Map<string, { affinity: number; cells: number }>;

export const rankPlaces = defineTool({
  name: 'rankPlaces',
  description:
    "Ranks cities by where the anchors' audience concentrates, from one heatmap call so the cities compare. Cities from any region in the city table; a city with too few cells is not ranked.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    places: z.array(z.string().min(1)).min(1).max(30),
    /**
     * Neighbourhoods to read from the same call. Coordinates come from the planner and are checked
     * against the city's box.
     */
    areas: z
      .array(
        z.object({
          city: z.string().min(1),
          name: z.string().min(1),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      )
      .max(24)
      .default([]),
  }),
  async run(ctx, { entityIds, places, areas }) {
    const boxes = places.flatMap((p) => cityBox(p) ?? []);
    if (boxes.length === 0) {
      const data: z.infer<typeof rankPlacesOutputSchema> = {
        places: places.map((place) => unknownPlace(place)),
        areas: [],
        receiptId: null,
        leaveOneOut: null,
      };
      return { data, receipts: [] };
    }

    const ask = (ids: string[]) =>
      qloo.insights.heatmap(ctx.qloo, {
        'filter.location': multiPolygon(boxes),
        'signal.interests.entities': ids,
      });
    const { data: response, call } = await ask(entityIds);
    const full = score(boxes, response.results.heatmap);

    const loo = await leaveOneOut(
      ctx,
      entityIds,
      full,
      async (without, left) => {
        const rerun = await ask(without);
        const value = score(boxes, rerun.data.results.heatmap);
        const receipt = toReceipt(rerun.call, {
          returned: { places: Object.fromEntries(value) },
          rule: `Leave one out: the same ranking without ${nameOf(ctx, left)}.`,
          confidence: 'medium',
          source: ctx.source,
        });
        return { value, receipt };
      },
      { same: (a, b) => topThree(a).join() === topThree(b).join(), moved },
    );

    const known = countKnown(
      loo.contributing.map((id) => ctx.entities.get(id)?.popularity ?? null),
    );
    const order = ranked(full);
    const rankedMean =
      order.reduce((sum, name) => sum + (full.get(name)?.affinity ?? 0), 0) / (order.length || 1);
    const rows = places.map((place) => {
      const box = boxes.find((b) => b.name === place);
      if (!box) return unknownPlace(place);
      const scored = full.get(place) ?? { affinity: 0, cells: 0 };
      const rank = order.indexOf(place);
      const placeLift = rank === -1 || rankedMean <= 0 ? null : lift(scored.affinity, rankedMean);
      const { level, reason } = confidenceFor({
        anchorsWithData: loo.contributing.length,
        knownAnchors: known,
        leaveOneOut: loo.check,
        nearEdge: placeLift !== null && isNearEdge('lift', placeLift),
        cells: scored.cells,
      });
      return {
        place,
        status: rank === -1 ? ('not_ranked' as const) : ('ranked' as const),
        rank: rank === -1 ? null : rank + 1,
        affinity: rank === -1 ? null : scored.affinity,
        lift: placeLift,
        band: placeLift === null ? null : liftBand(placeLift),
        cells: scored.cells,
        confidence: level,
        why: reason,
      };
    });

    const top = rows.find((r) => r.rank === 1);
    const headline: ConfidenceResult = top
      ? { level: top.confidence, reason: top.why }
      : { level: 'lower', reason: 'lower: no city had enough cells to rank' };
    const read = readAreas(response.results.heatmap, areas, boxes, full);
    const receipt = toReceipt(call, {
      returned: { places: Object.fromEntries(full), ...(read.length ? { areas: read } : {}) },
      rule: `${RANK_RULE}${read.length ? " A neighbourhood is the mean affinity of the heatmap cells nearest its centre, over its city's mean." : ''} Confidence ${headline.reason}.`,
      confidence: headline.level,
      source: ctx.source,
    });
    const data: z.infer<typeof rankPlacesOutputSchema> = {
      places: rows,
      areas: read,
      receiptId: receipt.callId,
      leaveOneOut: loo.check ?? null,
    };
    return { data, receipts: [receipt, ...loo.receipts] };
  },
});

// Cells nearest a neighbourhood's centre. More than this blurs it into the next one.
const AREA_CELLS = 8;
// Farther than this (in degrees, about 11 km) a cell is not near the neighbourhood.
const AREA_REACH = 0.1;
// Fewer cells than this is a guess, not a reading.
const AREA_MIN_CELLS = 3;

type HeatCell = { location: { latitude: number; longitude: number }; query: { affinity: number } };

/**
 * Reads neighbourhoods from cells the call already returned (no extra call). A centre outside its
 * city's box, or with too few cells near it, has no reading.
 */
export function readAreas(
  cells: HeatCell[],
  areas: { city: string; name: string; latitude: number; longitude: number }[],
  boxes: CityBox[],
  scored: Scored,
): z.infer<typeof rankPlacesOutputSchema>['areas'] {
  const read = areas.flatMap((area) => {
    const box = boxes.find((b) => b.name.toLowerCase() === area.city.toLowerCase());
    if (!box || !inBox(box, area.latitude, area.longitude)) return [];
    const near = cells
      .map((c) => ({
        affinity: c.query.affinity,
        d: Math.hypot(
          c.location.latitude - area.latitude,
          (c.location.longitude - area.longitude) * Math.cos((area.latitude * Math.PI) / 180),
        ),
      }))
      .filter((c) => c.d <= AREA_REACH)
      .sort((a, b) => a.d - b.d)
      .slice(0, AREA_CELLS);
    if (near.length < AREA_MIN_CELLS) return [];
    const affinity = near.reduce((sum, c) => sum + c.affinity, 0) / near.length;
    const cityMean = scored.get(box.name)?.affinity ?? 0;
    return [
      {
        city: box.name,
        name: area.name,
        affinity,
        lift: cityMean > 0 ? lift(affinity, cityMean) : null,
        cells: near.length,
        rank: 0,
      },
    ];
  });
  // Strongest first, numbered within each city. A name given twice is read once.
  const seen = new Set<string>();
  const unique = read.filter((a) => {
    const key = `${a.city}|${a.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique
    .sort((a, b) => b.affinity - a.affinity)
    .map((a) => ({
      ...a,
      rank: unique.filter((x) => x.city === a.city && x.affinity > a.affinity).length + 1,
    }));
}

function unknownPlace(place: string) {
  return {
    place,
    status: 'unknown_place' as const,
    rank: null,
    affinity: null,
    lift: null,
    band: null,
    cells: 0,
    confidence: 'lower' as const,
    why: 'lower: this city is not in the city table, so it was not tested',
  };
}

function score(
  boxes: CityBox[],
  cells: { location: { latitude: number; longitude: number }; query: { affinity: number } }[],
): Scored {
  const scored: Scored = new Map();
  for (const box of boxes) {
    const inside = cells.filter((c) => inBox(box, c.location.latitude, c.location.longitude));
    const total = inside.reduce((sum, c) => sum + c.query.affinity, 0);
    scored.set(box.name, {
      affinity: inside.length ? total / inside.length : 0,
      cells: inside.length,
    });
  }
  return scored;
}

function ranked(scored: Scored): string[] {
  return [...scored.entries()]
    .filter(([, s]) => s.cells >= MIN_PLACE_CELLS)
    .sort(([, a], [, b]) => b.affinity - a.affinity)
    .map(([name]) => name);
}

function topThree(scored: Scored): string[] {
  return ranked(scored).slice(0, 3);
}

// "Changed nothing to three decimals" is how a comp that contributed nothing showed up live.
function moved(a: Scored, b: Scored): boolean {
  return [...a.entries()].some(([name, s]) => {
    const other = b.get(name);
    return !other || Math.abs(s.affinity - other.affinity) >= 0.001 || s.cells !== other.cells;
  });
}
