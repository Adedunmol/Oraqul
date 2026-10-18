import { qlooEntityTypeSchema, type Receipt } from '@oraqul/schema';
import { z } from 'zod';
import * as qloo from '../qloo';
import { QlooError } from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

const MAX_CANDIDATES = 5;

const candidateSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  popularity: z.number().nullable(),
  /** What tells same-name titles apart for the person picking, such as "2018 · Nigeria". */
  detail: z.string().nullable(),
});

const releaseSchema = z.looseObject({
  release_year: z.number().optional(),
  release_country: z.union([z.string(), z.array(z.string())]).optional(),
});

/** A title with case, accents, spacing and the style of quotes and apostrophes removed. */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Same name, ignoring case, accents, spacing and the style of quotes and apostrophes. */
export function sameTitle(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

function detailOf(entity: { disambiguation?: string; properties?: unknown }): string | null {
  const release = releaseSchema.safeParse(entity.properties ?? {});
  const year = release.success ? release.data.release_year : undefined;
  const country = release.success ? release.data.release_country : undefined;
  const parts = [
    year === undefined ? entity.disambiguation : String(year),
    Array.isArray(country) ? country[0] : country,
  ].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(' · ') : null;
}

export const resolveBundleOutputSchema = z.object({
  anchors: z.array(
    z.object({
      name: z.string(),
      /**
       * `found`: one exact name match. `ambiguous`: several, so the user picks. `not_found`: no
       * exact match; search never says "not found" on its own, so this is our decision.
       */
      status: z.enum(['found', 'ambiguous', 'not_found', 'failed']),
      entityId: z.string().nullable(),
      popularity: z.number().nullable(),
      candidates: z.array(candidateSchema),
      receiptId: z.string().nullable(),
    }),
  ),
  /** The anchors that resolved, ready to use as one signal. */
  entityIds: z.array(z.string()),
});

type Anchor = z.infer<typeof resolveBundleOutputSchema>['anchors'][number];

export const resolveBundle = defineTool({
  name: 'resolveBundle',
  description:
    'Describes a launch as a bundle of anchors: finds each comparable title (and the title itself once released) in Qloo by exact name. Returns the ones found, and those the user must pick between.',
  input: z.object({
    names: z.array(z.string().min(1)).min(1).max(8),
    types: z.array(qlooEntityTypeSchema).min(1),
  }),
  async run(ctx, { names, types }) {
    const resolved = await Promise.all(names.map((name) => resolveOne(name)));
    const anchors = resolved.map((r) => r.anchor);
    const receipts = resolved.flatMap((r) => (r.receipt ? [r.receipt] : []));
    const data: z.infer<typeof resolveBundleOutputSchema> = {
      anchors,
      entityIds: anchors.flatMap((a) => (a.status === 'found' && a.entityId ? [a.entityId] : [])),
    };
    return { data, receipts };

    async function resolveOne(name: string): Promise<{ anchor: Anchor; receipt: Receipt | null }> {
      try {
        const { data: response, call } = await qloo.lookup.search(ctx.qloo, {
          query: name,
          types,
          take: MAX_CANDIDATES,
        });
        const candidates = response.results.map((e) => ({
          entityId: e.entity_id,
          name: e.name,
          popularity: e.popularity ?? null,
          detail: detailOf(e),
        }));
        for (const c of candidates) ctx.entities.set(c.entityId, c);
        const exact = candidates.filter((c) => sameTitle(c.name, name));
        const match = exact.length === 1 ? exact[0] : undefined;
        const status = match ? 'found' : exact.length > 1 ? 'ambiguous' : 'not_found';
        const why = {
          found: 'high: one exact match',
          ambiguous: 'lower: several share the name',
          not_found: 'lower: no exact match',
        }[status];
        const receipt = toReceipt(call, {
          returned: { candidates },
          rule: `An anchor counts as found only when one candidate has its exact name. Confidence ${why}.`,
          confidence: match ? 'high' : 'lower',
          source: ctx.source,
        });
        return {
          anchor: {
            name,
            status,
            entityId: match?.entityId ?? null,
            popularity: match?.popularity ?? null,
            candidates: status === 'found' ? [] : exact.length > 1 ? exact : candidates,
            receiptId: receipt.callId,
          },
          receipt,
        };
      } catch (err) {
        if (!(err instanceof QlooError)) throw err;
        const receipt = toReceipt(err.call, {
          returned: err.call.returned,
          rule: `Could not test: ${err.message}`,
          confidence: 'lower',
          source: ctx.source,
        });
        return {
          anchor: {
            name,
            status: 'failed',
            entityId: null,
            popularity: null,
            candidates: [],
            receiptId: receipt.callId,
          },
          receipt,
        };
      }
    }
  },
});
