import { qlooEntityTypeSchema } from '@oraqul/schema';
import { z } from 'zod';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

export const resolveTagsOutputSchema = z.object({
  tags: z.array(
    z.object({
      phrase: z.string(),
      /** Null when Qloo has no tag of the wanted kind for the phrase. */
      tagId: z.string().nullable(),
      name: z.string().nullable(),
      receiptId: z.string(),
    }),
  ),
});

export const resolveTags = defineTool({
  name: 'resolveTags',
  description:
    'Turns phrases such as "afrobeats" or "movie theater" into Qloo tag urns, one lookup each. Give the tag namespace prefix the tag must start with, such as `urn:tag:genre:music` or `urn:tag:category:place`, and for brand categories the parent `urn:entity:brand`. Tags are never guessed: a phrase with no match comes back null.',
  input: z.object({
    phrases: z
      .array(
        z.object({
          phrase: z.string().min(1),
          /** The urn the tag must start with. */
          prefix: z.string().startsWith('urn:tag:'),
          /** Without it, "telecom" matches place categories rather than brand ones. */
          parent: qlooEntityTypeSchema.nullable().default(null),
        }),
      )
      .min(1)
      .max(8),
  }),
  async run(ctx, { phrases }) {
    const tags: z.infer<typeof resolveTagsOutputSchema>['tags'] = [];
    const receipts = [];
    for (const { phrase, prefix, parent } of phrases) {
      const { data, call } = await qloo.lookup.tags(ctx.qloo, {
        'filter.query': phrase,
        ...(parent ? { 'filter.parents.types': [parent] } : {}),
        take: 10,
      });
      const hit = data.results.tags.find((t) => t.id.startsWith(prefix)) ?? null;
      const receipt = toReceipt(call, {
        returned: { tag: hit ? { id: hit.id, name: hit.name } : null },
        rule: `The first tag Qloo lists for "${phrase}" whose urn starts with ${prefix}. None means the phrase is not used as a filter.`,
        confidence: hit ? 'high' : 'lower',
        source: ctx.source,
      });
      receipts.push(receipt);
      tags.push({
        phrase,
        tagId: hit?.id ?? null,
        name: hit?.name ?? null,
        receiptId: receipt.callId,
      });
    }
    const data: z.infer<typeof resolveTagsOutputSchema> = { tags };
    return { data, receipts };
  },
});
