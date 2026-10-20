import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import type { QlooTag } from '../qloo/responses';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// Spec §5, topic ownership. Qloo's compare call returns each side's own tags with a count, and the
// tags both sides share, all from one call, so the two sides are never scored in separate calls.
// TODO(verify): the shape of `results.a` and `results.b` for podcast signals, with
// `qloo-podcasts-probes.ts`. Until qloo.md says so, a topic map is not claimed to beat a chatbot.
const RULE =
  "Qloo compares your show's audience with the rival shows' audience in one call. A topic is yours when only your audience carries it, and shared when both audiences do.";

export const topicMapOutputSchema = z.object({
  yours: z.array(
    z.object({
      tagId: z.string(),
      name: z.string(),
      /** Its count against a typical rival topic. For ordering and sizing: it never decides ownership. */
      weight: z.number().min(0),
    }),
  ),
  shared: z.array(z.object({ tagId: z.string(), name: z.string() })),
  /** What rival shows lean to that your audience does not. */
  rivals: z.array(z.object({ tagId: z.string(), name: z.string() })),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

const countOf = (t: QlooTag): number => {
  const n = Number(t.query?.count ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const meanOf = (tags: readonly QlooTag[]): number => {
  const counts = tags.map(countOf).filter((n) => n > 0);
  return counts.length ? counts.reduce((sum, n) => sum + n, 0) / counts.length : 0;
};

/**
 * Splits the tags of one compare call into yours, shared and the rivals'. A topic is yours when
 * Qloo lists it only on your side, shared when both sides carry it. Its weight is its count
 * against the mean count of a rival topic (or of your own, when the rival side has no counts), so
 * 1 is as heavy as a typical rival topic. The weight orders the topics and sizes them on screen;
 * it never decides who owns one. Pure, so the rule is testable apart from Qloo.
 */
export function topicOwnership(
  own: readonly QlooTag[],
  shared: readonly QlooTag[],
  rival: readonly QlooTag[],
) {
  const sharedIds = new Set(shared.map((t) => t.tag_id));
  const typical = meanOf(rival) || meanOf(own);
  return {
    yours: own
      .filter((t) => !sharedIds.has(t.tag_id))
      .map((t) => ({
        tagId: t.tag_id,
        name: t.name,
        weight: typical > 0 ? round2(countOf(t) / typical) : 0,
      }))
      .sort((x, y) => y.weight - x.weight),
    shared: shared.map((t) => ({ tagId: t.tag_id, name: t.name })),
    rivals: rival.map((t) => ({ tagId: t.tag_id, name: t.name })),
  };
}

export const topicMap = defineTool({
  name: 'topicMap',
  description:
    "The topics a show's audience carries that rival shows' audiences do not, from one comparison call. Use it for a podcast's positioning.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    rivalIds: z.array(z.string()).min(1).max(6),
    take: z.number().int().min(1).max(20).default(8),
  }),
  async run(ctx, { entityIds, rivalIds, take }) {
    const { data, call } = await qloo.analysis.compare(ctx.qloo, {
      a: entityIds,
      b: rivalIds,
      take: 50,
    });
    const split = topicOwnership(data.results.a, data.results.tags, data.results.b);
    const out = {
      yours: split.yours.slice(0, take),
      shared: split.shared.slice(0, take),
      rivals: split.rivals.slice(0, take),
    };
    const { level, reason } = confidenceFor({
      anchorsWithData: entityIds.length,
      knownAnchors: countKnown(entityIds.map((id) => ctx.entities.get(id)?.popularity ?? null)),
      cannotTest: out.yours.length === 0 && out.shared.length === 0 && out.rivals.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: out,
      rule: `${RULE} Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const result: z.infer<typeof topicMapOutputSchema> = {
      ...out,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data: result, receipts: [receipt] };
  },
});
