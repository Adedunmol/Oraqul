import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// Verified live (docs/backend/qloo.md): `/entities` returns `content_rating`, `release_year`,
// `release_country` and `production_company` in `properties`. Genres, subgenres and themes are not
// properties: they arrive as typed tags.
const propertiesSchema = z.looseObject({
  content_rating: z.string().optional(),
  release_year: z.number().optional(),
});

const tagKind = (type: string | undefined) => type?.match(/^urn:tag:([a-z_]+):/)?.[1];

export const filmProfilesOutputSchema = z.object({
  films: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      releaseYear: z.number().nullable(),
      contentRating: z.string().nullable(),
      genres: z.array(z.string()),
      subgenres: z.array(z.string()),
      themes: z.array(z.string()),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

export const filmProfiles = defineTool({
  name: 'filmProfiles',
  description:
    'What Qloo holds about each film or series: release year, content rating, genres, subgenres and themes. One lookup, no scoring. Use it to check that the comps fit together and what they are rated.',
  input: z.object({
    entityIds: z.array(z.string()).min(1).max(20),
  }),
  async run(ctx, { entityIds }) {
    const { data: response, call } = await qloo.lookup.entities(ctx.qloo, entityIds);
    const films = response.results.map((e) => {
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
        releaseYear: p.release_year ?? null,
        contentRating: p.content_rating ?? null,
        genres: named('genre'),
        subgenres: named('subgenre'),
        themes: named('theme'),
      };
    });
    for (const e of response.results) {
      ctx.entities.set(e.entity_id, { name: e.name, popularity: e.popularity ?? null });
    }
    const withData = films.filter((f) => f.genres.length > 0 || f.contentRating !== null);
    const { level, reason } = confidenceFor({
      anchorsWithData: withData.length,
      knownAnchors: countKnown(
        withData.map((f) => ctx.entities.get(f.entityId)?.popularity ?? null),
      ),
      cannotTest: withData.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: { films },
      rule: `What Qloo lists for each film or series, as returned. Nothing is scored. Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof filmProfilesOutputSchema> = {
      films,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt] };
  },
});
