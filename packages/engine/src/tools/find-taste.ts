import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import type { EntityInsightsRequest } from '../qloo/insights';
import { type SignalAgeBand, signalAgeBands } from '../qloo/urns';
import { toReceipt } from '../receipts';
import { defineTool } from './tool';

// What a comp signal returns once it carries context: a tag, a city, an age band, a release
// country, a year. Each shaping parameter is verified in qloo.md; without
// one an open-ended list drifts to what is popular overall.
export const tasteTypes = [
  'urn:entity:artist',
  'urn:entity:movie',
  'urn:entity:tv_show',
  'urn:entity:podcast',
  'urn:entity:brand',
  'urn:entity:place',
  'urn:entity:videogame',
  'urn:entity:person',
] as const;
const tasteTypeSchema = z.enum(tasteTypes);
export type TasteType = (typeof tasteTypes)[number];

const MAX_TAKE = 10;

const detailSchema = z.looseObject({
  release_year: z.number().optional(),
  address: z.string().optional(),
});

export const findTasteOutputSchema = z.object({
  candidates: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      affinity: z.number().nullable(),
      popularity: z.number().nullable(),
      /** The release year, or a place's address. */
      detail: z.string().nullable(),
    }),
  ),
  confidence: z.enum(['high', 'medium', 'lower']),
  why: z.string(),
  receiptId: z.string(),
});

export const findTaste = defineTool({
  name: 'findTaste',
  description:
    "Finds what the anchors' audience likes in one entity type, shaped by context: tags (urns from `resolveTags`), a city, age bands, a community audience, a release country and a first year. One call. Always give at least one shaping parameter: an open-ended list drifts to what is popular overall.",
  input: z.object({
    entityIds: z.array(z.string()).min(1),
    type: tasteTypeSchema,
    tags: z.array(z.string()).default([]),
    /** For places this is where the results are; for everything else it biases the ranking. */
    city: z.string().nullable().default(null),
    ages: z.array(z.enum(signalAgeBands)).default([]),
    /** Audience ids from `lookup.audiences`. */
    audiences: z.array(z.string()).default([]),
    /** Films and series only. The full country name: a two-letter code returns nothing. */
    country: z.string().nullable().default(null),
    /** Films and series only. */
    yearFrom: z.number().int().nullable().default(null),
    take: z.number().int().min(1).max(MAX_TAKE).default(6),
    exclude: z.array(z.string()).default([]),
    /**
     * Rank only these entities (Qloo's `filter.results.entities`): candidates we chose, such as
     * brands that could realistically partner, ranked by Qloo for this audience. Without it the
     * list is whatever Qloo finds closest, which for brands is the biggest names.
     */
    only: z.array(z.string()).max(50).default([]),
  }),
  async run(ctx, input) {
    const left = [...input.entityIds, ...input.exclude];
    const { data: response, call } = await qloo.insights.entities(ctx.qloo, request(input, left));
    const candidates = response.results.entities
      .filter((e) => !left.includes(e.entity_id))
      .slice(0, input.take)
      .map((e) => {
        const props = detailSchema.safeParse(e.properties ?? {});
        const detail = props.success
          ? (props.data.address ??
            (props.data.release_year ? String(props.data.release_year) : null))
          : null;
        return {
          entityId: e.entity_id,
          name: e.name,
          affinity: e.query?.affinity ?? null,
          popularity: e.popularity ?? null,
          detail,
        };
      });
    for (const c of candidates) ctx.entities.set(c.entityId, c);

    const { level, reason } = confidenceFor({
      anchorsWithData: input.entityIds.length,
      knownAnchors: countKnown(
        input.entityIds.map((id) => ctx.entities.get(id)?.popularity ?? null),
      ),
      cannotTest: candidates.length === 0,
    });
    const receipt = toReceipt(call, {
      returned: { candidates },
      rule: `The ${candidates.length} results Qloo ranks closest to the anchors' audience with this context, in Qloo's order. Confidence ${reason}.`,
      confidence: level,
      source: ctx.source,
    });
    const data: z.infer<typeof findTasteOutputSchema> = {
      candidates,
      confidence: level,
      why: reason,
      receiptId: receipt.callId,
    };
    return { data, receipts: [receipt] };
  },
});

interface Shape {
  entityIds: string[];
  type: TasteType;
  tags: string[];
  city: string | null;
  ages: SignalAgeBand[];
  audiences: string[];
  country: string | null;
  yearFrom: number | null;
  take: number;
  only: string[];
}

function request(input: Shape, left: string[]): EntityInsightsRequest {
  const base = {
    'signal.interests.entities': input.entityIds,
    'filter.exclude.entities': left,
    // Exclusions come back out of the take, so ask for enough to fill it.
    take: Math.min(input.take + left.length, 50),
    ...(input.only.length ? { 'filter.results.entities': input.only } : {}),
    ...(input.tags.length ? { 'filter.tags': input.tags } : {}),
    ...(input.ages.length ? { 'signal.demographics.age': input.ages } : {}),
    ...(input.audiences.length ? { 'signal.demographics.audiences': input.audiences } : {}),
  };
  const near = input.city ? { 'signal.location.query': input.city } : {};
  const film = {
    ...(input.country ? { 'filter.release_country': [input.country] } : {}),
    ...(input.yearFrom ? { 'filter.release_year.min': input.yearFrom } : {}),
  };
  switch (input.type) {
    case 'urn:entity:place':
      return {
        ...base,
        'filter.type': input.type,
        ...(input.city ? { 'filter.location.query': input.city } : {}),
      };
    case 'urn:entity:movie':
    case 'urn:entity:tv_show':
      return { ...base, ...near, ...film, 'filter.type': input.type };
    case 'urn:entity:artist':
    case 'urn:entity:podcast':
    case 'urn:entity:brand':
    case 'urn:entity:videogame':
    case 'urn:entity:person':
      return { ...base, ...near, 'filter.type': input.type };
  }
}
