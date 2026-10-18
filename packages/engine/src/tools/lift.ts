import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { isNearEdge, liftBand, lift as liftOf } from '../scoring';
import { leaveOneOut, nameOf } from './leave-one-out';
import { defineTool } from './tool';

// Scoring a candidate list with `filter.results.entities` is verified live for books (qloo.md,
// conflict 18) and films (2026-10-16, qloo:film-tools). TODO(verify): series, brands, podcasts.
const scoredTypes = z.enum([
  'urn:entity:movie',
  'urn:entity:tv_show',
  'urn:entity:book',
  'urn:entity:brand',
  'urn:entity:podcast',
]);

const LIFT_RULE =
  "Qloo scores the candidates and the baseline against the anchors' audience in one call. Lift is the candidates' mean affinity over the baseline's. Strong at 1.5 and above, usable from 1.2, weak below.";

export const liftOutputSchema = z.object({
  /** Null when the baseline came back without scores, so nothing could be compared. */
  lift: z.number().nullable(),
  band: z.enum(['strong', 'usable', 'weak']).nullable(),
  candidates: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      affinity: z.number().nullable(),
      /** This candidate's affinity over the baseline's mean, from the same call. */
      lift: z.number().nullable(),
    }),
  ),
  baseline: z.array(
    z.object({ entityId: z.string(), name: z.string(), affinity: z.number().nullable() }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

interface Scores {
  byId: Map<string, { name: string; affinity: number | null }>;
  lift: number | null;
  /** The baseline's mean affinity, null when none of it was scored. */
  base: number | null;
}

export const lift = defineTool({
  name: 'lift',
  description:
    "Lift of a set of candidate titles over a baseline of other kinds, for the anchors' audience, from one ranking call. Use it to test whether the audience prefers this kind of title.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    type: scoredTypes,
    candidates: z.array(z.string()).min(1),
    baseline: z.array(z.string()).min(1),
  }),
  async run(ctx, { entityIds, type, candidates, baseline }) {
    const ask = (ids: string[]) =>
      qloo.insights.entities(ctx.qloo, {
        'filter.type': type,
        'signal.interests.entities': ids,
        'filter.results.entities': [...candidates, ...baseline],
        take: candidates.length + baseline.length,
      });
    const read = (results: { entity_id: string; name: string; query?: { affinity?: number } }[]) =>
      scores(results, candidates, baseline);

    const { data: response, call } = await ask(entityIds);
    const full = read(response.results.entities);
    const fullBand = full.lift === null ? null : liftBand(full.lift);

    const loo = await leaveOneOut(
      ctx,
      entityIds,
      full,
      async (without, left) => {
        const rerun = await ask(without);
        const value = read(rerun.data.results.entities);
        const receipt = toReceipt(rerun.call, {
          returned: { lift: value.lift },
          rule: `Leave one out: the same scoring without ${nameOf(ctx, left)}.`,
          confidence: 'medium',
          source: ctx.source,
        });
        return { value, receipt };
      },
      {
        same: (a, b) =>
          (a.lift === null ? null : liftBand(a.lift)) ===
          (b.lift === null ? null : liftBand(b.lift)),
        moved: (a, b) =>
          [...a.byId].some(([id, s]) => {
            const other = b.byId.get(id)?.affinity ?? null;
            return s.affinity === null || other === null || Math.abs(s.affinity - other) >= 0.001;
          }),
      },
    );

    const { level, reason } = confidenceFor({
      anchorsWithData: loo.contributing.length,
      knownAnchors: countKnown(
        loo.contributing.map((id) => ctx.entities.get(id)?.popularity ?? null),
      ),
      leaveOneOut: loo.check,
      nearEdge: full.lift !== null && isNearEdge('lift', full.lift),
      cannotTest: full.lift === null,
    });
    const rows = (ids: string[]) =>
      ids.map((id) => ({
        entityId: id,
        name: full.byId.get(id)?.name ?? nameOf(ctx, id),
        affinity: full.byId.get(id)?.affinity ?? null,
      }));
    const base = full.base;
    const candidateRows = rows(candidates).map((r) => ({
      ...r,
      lift: r.affinity === null || base === null || base <= 0 ? null : liftOf(r.affinity, base),
    }));
    const receipt = toReceipt(call, {
      returned: { lift: full.lift, band: fullBand, scores: Object.fromEntries(full.byId) },
      rule: `${LIFT_RULE} Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof liftOutputSchema> = {
      lift: full.lift,
      band: fullBand,
      candidates: candidateRows,
      baseline: rows(baseline),
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt, ...loo.receipts] };
  },
});

function scores(
  results: { entity_id: string; name: string; query?: { affinity?: number } }[],
  candidates: string[],
  baseline: string[],
): Scores {
  const byId = new Map(
    results.map((r) => [r.entity_id, { name: r.name, affinity: r.query?.affinity ?? null }]),
  );
  const mean = (ids: string[]) => {
    const values = ids.flatMap((id) => {
      const affinity = byId.get(id)?.affinity;
      return affinity === undefined || affinity === null ? [] : [affinity];
    });
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const kind = mean(candidates);
  const base = mean(baseline);
  return {
    byId,
    lift: kind === null || base === null || base <= 0 ? null : liftOf(kind, base),
    base,
  };
}
