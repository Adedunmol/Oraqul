import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// `urn:tag:theme:qloo`, `archetype:qloo` and `audience:qloo` on a comp signal are verified in
// qloo.md (2026-10-17). With no tag type the call returns mostly style adjectives.
export const themeTagTypes = ['theme', 'archetype', 'audience', 'plot'] as const;

export const themeTagsOutputSchema = z.object({
  kinds: z.array(
    z.object({
      kind: z.enum(themeTagTypes),
      tags: z.array(
        z.object({ tagId: z.string(), name: z.string(), affinity: z.number().nullable() }),
      ),
      receiptId: z.string(),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
});

export const themeTags = defineTool({
  name: 'themeTags',
  description:
    "The themes, archetypes or audience traits that best describe the anchors, one call per kind. Use them for a launch's hook and key messages.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    kinds: z.array(z.enum(themeTagTypes)).min(1).max(4),
    take: z.number().int().min(1).max(12).default(6),
  }),
  async run(ctx, { entityIds, kinds, take }) {
    const out: z.infer<typeof themeTagsOutputSchema>['kinds'] = [];
    const receipts = [];
    for (const kind of kinds) {
      const { data, call } = await qloo.insights.tags(ctx.qloo, {
        'signal.interests.entities': entityIds,
        'filter.tag.types': [`urn:tag:${kind}:qloo`],
        take,
      });
      const tags = data.results.tags.slice(0, take).map((t) => ({
        tagId: t.tag_id,
        name: t.name,
        affinity: t.query?.affinity ?? null,
      }));
      const receipt = toReceipt(call, {
        returned: { tags },
        rule: `The ${kind} tags Qloo ranks closest to the anchors, in Qloo's order.`,
        confidence: tags.length ? 'high' : 'lower',
        source: ctx.source,
      });
      receipts.push(receipt);
      out.push({ kind, tags, receiptId: receipt.callId });
    }
    const { level, reason } = confidenceFor({
      anchorsWithData: entityIds.length,
      knownAnchors: countKnown(entityIds.map((id) => ctx.entities.get(id)?.popularity ?? null)),
      cannotTest: out.every((k) => k.tags.length === 0),
    });
    const data: z.infer<typeof themeTagsOutputSchema> = {
      kinds: out,
      confidence: level,
      why: reason,
    };
    return { data, receipts };
  },
});
