import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

export const audienceOutputSchema = z.object({
  segments: z.array(
    z.object({
      entityId: z.string(),
      age: z.record(z.string(), z.number()),
      gender: z.record(z.string(), z.number()),
      topAgeBand: z.string().nullable(),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  /** The check that set the confidence (spec §5.1). */
  why: z.string(),
});

export const audienceBySegment = defineTool({
  name: 'audienceBySegment',
  description:
    'Age and gender skew of the audience for one or more Qloo entities, as an affinity per segment. Positive means over-represented.',
  input: z.object({ entityIds: z.array(z.string()).min(1) }),
  async run(ctx, { entityIds }) {
    const { data: response, call } = await qloo.insights.demographics(ctx.qloo, {
      'signal.interests.entities': entityIds,
    });
    const segments = response.results.demographics.map((row) => {
      const age = row.query.age ?? {};
      const topAge = Object.entries(age).sort(([, a], [, b]) => b - a)[0];
      return {
        entityId: row.entity_id,
        age,
        gender: row.query.gender ?? {},
        topAgeBand: topAge ? topAge[0] : null,
      };
    });

    const { level, reason } = confidenceFor({
      anchorsWithData: segments.length,
      knownAnchors: countKnown(
        segments.map((s) => ctx.entities.get(s.entityId)?.popularity ?? null),
      ),
      cannotTest: segments.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: { segments },
      rule: `Skew is the affinity Qloo gives each age and gender band. The top band is the highest age affinity. ${segments.length} of ${entityIds.length} returned a row. Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof audienceOutputSchema> = { segments, confidence: level, why: reason };
    return { data, receipts: [receipt] };
  },
});
