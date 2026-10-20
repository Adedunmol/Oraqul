import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import type { QlooTag } from '../qloo/responses';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// Spec §5, topic ownership. Verified on the live host (2026-10-20, qloo.md): `analysis.compare` lists
// every tag each group carries (`results.a`, `results.b`) with `query.count`, the number of that
// group's shows that carry it, and the tags both share with a near constant score. One call, so the
// two sides are never scored in separate calls.
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

// A topic is a subject. Qloo also tags a show's style ("Immersive"), its host ("Charismatic"), its
// audience and its content type; those say how a show sounds, not what it is about (live probe
// 2026-10-20), so only subject tags count.
const SUBJECT_TAG = /^urn:tag:(theme|keyword|subgenre|genre):/;
const subjects = (tags: readonly QlooTag[]) => tags.filter((t) => SUBJECT_TAG.test(t.tag_id));

// Qloo lists one topic under several namespaces ("True Crime" as a genre, a keyword and a theme), so
// topics are told apart by name, keeping the highest count.
const key = (name: string) => name.trim().toLowerCase();

function countsByName(tags: readonly QlooTag[]): Map<string, { name: string; count: number }> {
  const out = new Map<string, { name: string; count: number }>();
  for (const t of tags) {
    const seen = out.get(key(t.name));
    const count = countOf(t);
    if (!seen || count > seen.count) out.set(key(t.name), { name: seen?.name ?? t.name, count });
  }
  return out;
}

/**
 * Splits the tags of one compare call into yours, shared and the rivals'. Qloo lists every tag each
 * group carries, with the number of that group's shows that carry it, so a topic is yours when only
 * your side lists it and the rivals' when only theirs does; one both list is shared. A yours topic's
 * weight is the share of your shows that carry it against the mean share of a rival topic among the
 * rival shows (or of your own topics, when the rival side has no counts), so 1 is as common among
 * your shows as a typical rival topic is among theirs. The weight orders the topics and sizes them
 * on screen; it never decides who owns one. Pure, so the rule is testable apart from Qloo.
 */
export function topicOwnership(
  ownTags: readonly QlooTag[],
  sharedTags: readonly QlooTag[],
  rivalTags: readonly QlooTag[],
  sizes: { own: number; rival: number },
) {
  const own = subjects(ownTags);
  const shared = subjects(sharedTags);
  const rival = subjects(rivalTags);
  const mine = countsByName(own);
  const theirs = countsByName(rival);
  const both = new Set([...shared.map((t) => key(t.name))]);
  const share = (count: number, of: number) => (of > 0 ? count / of : 0);
  const mean = (m: Map<string, { count: number }>, of: number) => {
    const shares = [...m.values()].map((v) => share(v.count, of)).filter((n) => n > 0);
    return shares.length ? shares.reduce((sum, n) => sum + n, 0) / shares.length : 0;
  };
  const typical = mean(theirs, sizes.rival) || mean(mine, sizes.own);
  const ids = new Map<string, string>();
  for (const t of [...own, ...shared, ...rival])
    if (!ids.has(key(t.name))) ids.set(key(t.name), t.tag_id);
  const tagId = (name: string) => ids.get(key(name)) ?? name;
  const isShared = (k: string) => both.has(k) || (mine.has(k) && theirs.has(k));
  return {
    yours: [...mine.entries()]
      .filter(([k]) => !isShared(k))
      .map(([k, v]) => ({
        tagId: tagId(k),
        name: v.name,
        weight: typical > 0 ? round2(share(v.count, sizes.own) / typical) : 0,
      }))
      .sort((x, y) => y.weight - x.weight),
    shared: [...new Set([...both, ...[...mine.keys()].filter((k) => theirs.has(k))])].map((k) => {
      const name =
        mine.get(k)?.name ??
        theirs.get(k)?.name ??
        shared.find((t) => key(t.name) === k)?.name ??
        k;
      return { tagId: tagId(k), name };
    }),
    rivals: [...theirs.entries()]
      .filter(([k]) => !isShared(k))
      .map(([k, v]) => ({ tagId: tagId(k), name: v.name })),
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
    const split = topicOwnership(data.results.a, data.results.tags, data.results.b, {
      own: entityIds.length,
      rival: rivalIds.length,
    });
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
