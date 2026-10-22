import { z } from 'zod';
import { confidenceFor, countKnown } from '../confidence';
import * as qloo from '../qloo';
import type { EntityInsightsRequest } from '../qloo/insights';
import {
  type ContentRating,
  type Gender,
  genders,
  type SignalAgeBand,
  signalAgeBands,
} from '../qloo/urns';
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
  'urn:entity:book',
] as const;
const tasteTypeSchema = z.enum(tasteTypes);
export type TasteType = (typeof tasteTypes)[number];

const MAX_TAKE = 10;

/**
 * The film and series ratings that fit a family or an adult-only release. Qloo's filter takes any
 * of a list (checked live: PG alone, R alone and PG-13 with PG each gave their own list).
 */
export const ratingGroups = {
  family: ['G', 'PG', 'TV-G', 'TV-PG', 'TV-Y', 'TV-Y7'],
  adult: ['R', 'NC-17', 'TV-MA'],
} as const satisfies Record<string, readonly ContentRating[]>;

const detailSchema = z.looseObject({
  release_year: z.number().optional(),
  publication_year: z.number().optional(),
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
    /**
     * The anchors. May be empty only with a city and an age band: Qloo then lists what that age band
     * likes in that place, with no title behind it (verified in qloo.md, for large markets).
     */
    entityIds: z.array(z.string()).default([]),
    type: tasteTypeSchema,
    tags: z.array(z.string()).default([]),
    /** For places this is where the results are; for everything else it biases the ranking. */
    city: z.string().nullable().default(null),
    ages: z.array(z.enum(signalAgeBands)).default([]),
    /** Films and series only. The full country name: a two-letter code returns nothing. */
    country: z.string().nullable().default(null),
    /** Films, series and books: the first release or publication year. */
    yearFrom: z.number().int().nullable().default(null),
    /** Sent as `signal.demographics.gender`. Only when the brief says the audience is mostly one. */
    gender: z.enum(genders).nullable().default(null),
    /** Films and series only: keep the list to family or to adult-only releases. */
    rating: z.enum(['family', 'adult']).nullable().default(null),
    /**
     * Keeps the list to mid-size names. A cap alone returns records with no popularity, so give a
     * floor too, and pair it with a tag: untagged it drifts.
     */
    popularity: z
      .object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) })
      .nullable()
      .default(null),
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
    if (input.entityIds.length === 0 && !(input.city && input.ages.length > 0)) {
      throw new Error('findTaste needs an anchor, or a city and an age band');
    }
    const left = [...input.entityIds, ...input.exclude];
    const { data: response, call } = await qloo.insights.entities(ctx.qloo, request(input, left));
    const candidates = response.results.entities
      .filter((e) => !left.includes(e.entity_id))
      .slice(0, input.take)
      .map((e) => {
        const props = detailSchema.safeParse(e.properties ?? {});
        const detail = props.success
          ? (props.data.address ??
            ((props.data.release_year ?? props.data.publication_year)
              ? String(props.data.release_year ?? props.data.publication_year)
              : null))
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
  country: string | null;
  yearFrom: number | null;
  gender: Gender | null;
  rating: 'family' | 'adult' | null;
  popularity: { min: number; max: number } | null;
  take: number;
  only: string[];
}

function request(input: Shape, left: string[]): EntityInsightsRequest {
  const base = {
    ...(input.entityIds.length ? { 'signal.interests.entities': input.entityIds } : {}),
    ...(left.length ? { 'filter.exclude.entities': left } : {}),
    // Exclusions come back out of the take, so ask for enough to fill it.
    take: Math.min(input.take + left.length, 50),
    ...(input.only.length ? { 'filter.results.entities': input.only } : {}),
    ...(input.tags.length ? { 'filter.tags': input.tags } : {}),
    ...(input.ages.length ? { 'signal.demographics.age': input.ages } : {}),
    ...(input.gender ? { 'signal.demographics.gender': input.gender } : {}),
    ...(input.popularity
      ? {
          'filter.popularity.min': input.popularity.min,
          'filter.popularity.max': input.popularity.max,
        }
      : {}),
  };
  const near = input.city ? { 'signal.location.query': input.city } : {};
  const film = {
    ...(input.country ? { 'filter.release_country': [input.country] } : {}),
    ...(input.yearFrom ? { 'filter.release_year.min': input.yearFrom } : {}),
    ...(input.rating ? { 'filter.content_rating': [...ratingGroups[input.rating]] } : {}),
  };
  switch (input.type) {
    case 'urn:entity:book':
      return {
        ...base,
        ...near,
        ...(input.yearFrom ? { 'filter.publication_year.min': input.yearFrom } : {}),
        'filter.type': input.type,
      };
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
