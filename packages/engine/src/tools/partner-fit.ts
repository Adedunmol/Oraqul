import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import type { EntityInsightsRequest } from '../qloo/insights';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// Cross-domain results for a movie signal (brands, podcasts, series) are verified in qloo.md;
// whether they are good picks was only judged by eye on a few.
const discoverTypes = z.enum([
  'urn:entity:movie',
  'urn:entity:tv_show',
  'urn:entity:brand',
  'urn:entity:podcast',
]);

const MAX_TAKE = 10;

export const partnerFitOutputSchema = z.object({
  candidates: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      affinity: z.number().nullable(),
      popularity: z.number().nullable(),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

export const partnerFit = defineTool({
  name: 'partnerFit',
  description:
    "Finds the titles, brands or podcasts the anchors' audience likes most, from one call. These are candidates only: score them against a baseline with `lift` before calling any of them a fit.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    type: discoverTypes,
    take: z.number().int().min(1).max(MAX_TAKE).default(6),
    /** Movies and series only: leave out anything released before this year. */
    releasedFrom: z.number().int().optional(),
    /** Entities that must not come back as candidates, such as the baseline they are scored against. */
    exclude: z.array(z.string()).default([]),
  }),
  async run(ctx, { entityIds, type, take, releasedFrom, exclude }) {
    const left = [...entityIds, ...exclude];
    const signal = {
      'signal.interests.entities': entityIds,
      'filter.exclude.entities': left,
      take,
    };
    const request: EntityInsightsRequest =
      type === 'urn:entity:movie'
        ? {
            ...signal,
            'filter.type': type,
            ...(releasedFrom ? { 'filter.release_year.min': releasedFrom } : {}),
          }
        : { ...signal, 'filter.type': type };
    const { data: response, call } = await qloo.insights.entities(ctx.qloo, request);
    const candidates = response.results.entities
      .filter((e) => !left.includes(e.entity_id))
      .slice(0, take)
      .map((e) => ({
        entityId: e.entity_id,
        name: e.name,
        affinity: e.query?.affinity ?? null,
        popularity: e.popularity ?? null,
      }));
    for (const c of candidates) ctx.entities.set(c.entityId, c);

    const { level, reason } = confidenceFor({
      anchorsWithData: entityIds.length,
      knownAnchors: countKnown(entityIds.map((id) => ctx.entities.get(id)?.popularity ?? null)),
      cannotTest: candidates.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: { candidates },
      rule: `The ${candidates.length} ${type.replace('urn:entity:', '').replace('_', ' ')} results Qloo ranks closest to the anchors' audience. Candidates only: a fit comes from scoring them against a baseline. Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof partnerFitOutputSchema> = {
      candidates,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt] };
  },
});
