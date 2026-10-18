import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { isNearEdge, overlapBand, overlapFromAffinity } from '../scoring';
import { leaveOneOut, nameOf } from './leave-one-out';
import { defineTool } from './tool';

// Spec §5: overlap is each rival's affinity to the anchors' audience, from one scoring call.
// TODO(verify): the 35 and 60 band edges against a live run before a plan leads with them.
const RULE =
  "Qloo scores each rival against your comps' audience in one call. Overlap is that affinity × 100: above 60 is risky, 35 to 60 moderate, below 35 low.";

const bandSchema = z.enum(['risky', 'moderate', 'low']);

export const compareAudiencesOutputSchema = z.object({
  rivals: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      /** Null when Qloo did not score this rival. */
      overlap: z.number().int().nullable(),
      band: bandSchema.nullable(),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

type Scored = Map<string, { name: string; affinity: number | null }>;

export const compareAudiences = defineTool({
  name: 'compareAudiences',
  description:
    "How much of the anchors' audience each rival title shares, as an overlap from 0 to 100, from one scoring call. Use it for a rival date check.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    rivals: z.array(z.string()).min(1).max(12),
  }),
  async run(ctx, { entityIds, rivals }) {
    const ask = (ids: string[]) =>
      qloo.insights.entities(ctx.qloo, {
        'filter.type': 'urn:entity:movie',
        'signal.interests.entities': ids,
        'filter.results.entities': rivals,
        take: rivals.length,
      });
    const read = (results: { entity_id: string; name: string; query?: { affinity?: number } }[]) =>
      new Map<string, { name: string; affinity: number | null }>(
        results.map((r) => [r.entity_id, { name: r.name, affinity: r.query?.affinity ?? null }]),
      );
    const band = (s: Scored, id: string) => {
      const a = s.get(id)?.affinity;
      return a === null || a === undefined ? null : overlapBand(overlapFromAffinity(a));
    };

    const { data: response, call } = await ask(entityIds);
    const full = read(response.results.entities);
    const loo = await leaveOneOut(
      ctx,
      entityIds,
      full,
      async (without, left) => {
        const rerun = await ask(without);
        const value = read(rerun.data.results.entities);
        const receipt = toReceipt(rerun.call, {
          returned: { rivals: Object.fromEntries(value) },
          rule: `Leave one out: the same scoring without ${nameOf(ctx, left)}.`,
          confidence: 'medium',
          source: ctx.source,
        });
        return { value, receipt };
      },
      {
        same: (a, b) => rivals.every((id) => band(a, id) === band(b, id)),
        moved: (a, b) =>
          rivals.some((id) => {
            const x = a.get(id)?.affinity ?? null;
            const y = b.get(id)?.affinity ?? null;
            return x === null || y === null || Math.abs(x - y) >= 0.001;
          }),
      },
    );

    const rows = rivals.map((id) => {
      const affinity = full.get(id)?.affinity ?? null;
      const overlap = affinity === null ? null : overlapFromAffinity(affinity);
      return {
        entityId: id,
        name: full.get(id)?.name ?? nameOf(ctx, id),
        overlap,
        band: overlap === null ? null : overlapBand(overlap),
      };
    });
    const { level, reason } = confidenceFor({
      anchorsWithData: loo.contributing.length,
      knownAnchors: countKnown(
        loo.contributing.map((id) => ctx.entities.get(id)?.popularity ?? null),
      ),
      leaveOneOut: loo.check,
      nearEdge: rows.some((r) => r.overlap !== null && isNearEdge('overlap', r.overlap)),
      cannotTest: rows.every((r) => r.overlap === null),
    });
    const receipt = toReceipt(call, {
      returned: { rivals: rows },
      rule: `${RULE} Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof compareAudiencesOutputSchema> = {
      rivals: rows,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt, ...loo.receipts] };
  },
});
