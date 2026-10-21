import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// Verified live (docs/backend/qloo.md): `/entities` returns `publication_year` and `page_count` in
// `properties`, and typed tags for genre, book format (such as Audiobook) and age range.
const propertiesSchema = z.looseObject({
  publication_year: z.number().optional(),
  page_count: z.number().optional(),
});

const SERIES = /\(([^()]*?),?\s*#\d+(?:\.\d+)?\)\s*$/;

/** The series a title belongs to, from the mark Qloo adds to it ("Fourth Wing (The Empyrean, #1)"). */
export function seriesOf(title: string): string | null {
  const series = title.match(SERIES)?.[1]?.trim();
  return series ? series : null;
}

export const bookProfilesOutputSchema = z.object({
  books: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      publicationYear: z.number().nullable(),
      pages: z.number().nullable(),
      series: z.string().nullable(),
      genres: z.array(z.string()),
      formats: z.array(z.string()),
      ageRanges: z.array(z.string()),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

const tagKind = (type: string | undefined) => type?.match(/^urn:tag:([a-z_]+):/)?.[1];

export const bookProfiles = defineTool({
  name: 'bookProfiles',
  description:
    'What Qloo holds about each book: publication year, pages, series, genres, formats and age ranges. One lookup, no scoring. Use it to check how recent the comparable books are.',
  input: z.object({
    entityIds: z.array(z.string()).min(1).max(20),
  }),
  async run(ctx, { entityIds }) {
    const { data: response, call } = await qloo.lookup.entities(ctx.qloo, entityIds);
    const books = response.results.map((e) => {
      const props = propertiesSchema.safeParse(e.properties ?? {});
      const p = props.success ? props.data : {};
      const named = (kind: string) => [
        ...new Set(
          (e.tags ?? []).flatMap((t) => (tagKind(t.type) === kind && t.name ? [t.name] : [])),
        ),
      ];
      return {
        entityId: e.entity_id,
        name: e.name,
        publicationYear: p.publication_year ?? null,
        pages: p.page_count ?? null,
        series: seriesOf(e.name),
        genres: named('genre'),
        formats: named('book_format'),
        ageRanges: named('age_ranges'),
      };
    });
    for (const e of response.results) {
      ctx.entities.set(e.entity_id, { name: e.name, popularity: e.popularity ?? null });
    }
    const withData = books.filter((b) => b.publicationYear !== null);
    const { level, reason } = confidenceFor({
      anchorsWithData: withData.length,
      knownAnchors: countKnown(
        withData.map((b) => ctx.entities.get(b.entityId)?.popularity ?? null),
      ),
      cannotTest: withData.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: { books },
      rule: `What Qloo lists for each book, as returned. Nothing is scored. Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof bookProfilesOutputSchema> = {
      books,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt] };
  },
});
