import { qlooEntityTypeSchema } from '@oraqul/schema';
import { z } from 'zod';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

const MAX_CANDIDATES = 5;

export const searchEntity = defineTool({
  name: 'searchEntity',
  description:
    'Find a title, person, brand or place in Qloo by name. Returns candidates. When several share the top name, `ambiguous` is true and the user should pick.',
  input: z.object({ name: z.string().min(1), types: z.array(qlooEntityTypeSchema).min(1) }),
  async run(ctx, { name, types }) {
    const { data, call } = await qloo.lookup.search(ctx.qloo, {
      query: name,
      types,
      take: MAX_CANDIDATES,
    });
    const candidates = data.results.map((e) => ({
      entityId: e.entity_id,
      name: e.name,
      types: e.types ?? [],
      popularity: e.popularity ?? null,
    }));
    const top = candidates[0];
    const ambiguous =
      top !== undefined &&
      candidates.filter((c) => c.name.toLowerCase() === top.name.toLowerCase()).length > 1;

    // TODO(spec §5): confidence also depends on comps behind the signal and thin coverage lists.
    const confidence = candidates.length === 0 || ambiguous ? 'lower' : 'high';
    const receipt = toReceipt(call, {
      returned: { candidates },
      rule: 'Candidates are the names Qloo matched. More than one with the top name means the user picks.',
      confidence,
      source: ctx.source,
    });
    return { data: { candidates, ambiguous }, receipt };
  },
});
