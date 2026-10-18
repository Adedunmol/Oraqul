import { z } from 'zod';

// Objects are loose so the whole body can be stored on the call record as `returned`.
// Shapes were checked live (docs/backend/qloo.md). Fields not seen live stay optional with a
// TODO(verify).

/** A tag as `/v2/tags` lists it. Lookups use `id`, not `tag_id`. */
export const tagLookupSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  popularity: z.number().nullish(),
});
export type QlooTagLookup = z.infer<typeof tagLookupSchema>;

/** A tag as `urn:tag` insights and compare return it. These use `tag_id`. */
export const tagSchema = z.looseObject({
  tag_id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  popularity: z.number().nullish(),
  query: z
    .looseObject({
      // `affinity` on urn:tag insights, `score` on compare shared tags, `count` on compare sides.
      affinity: z.number().optional(),
      score: z.number().optional(),
      count: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});
export type QlooTag = z.infer<typeof tagSchema>;

/** A tag listed inside an entity. Its shape varies: some have `id`, some `tag_id`, some no name. */
export const entityTagSchema = z.looseObject({
  tag_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  value: z.string().optional(),
});
export type QlooEntityTag = z.infer<typeof entityTagSchema>;

export const entitySchema = z.looseObject({
  entity_id: z.string(),
  name: z.string(),
  /** `/search` and `/entities` give `types`; insights gives `subtype`. */
  types: z.array(z.string()).optional(),
  subtype: z.string().optional(),
  /** Null or missing for some titles. */
  popularity: z.number().nullish(),
  /** `/search` only: a short tell-apart, such as the release year `2018`. */
  disambiguation: z.string().optional(),
  properties: z.looseObject({}).optional(),
  tags: z.array(entityTagSchema).optional(),
  query: z
    .looseObject({
      affinity: z.number().optional(),
      explainability: z.json().optional(),
    })
    .optional(),
});
export type QlooEntity = z.infer<typeof entitySchema>;

export const audienceSchema = z.looseObject({
  // The two differ. `signal.demographics.audiences` takes `id`; `entity_id` had no effect.
  entity_id: z.string(),
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
});
export type QlooAudience = z.infer<typeof audienceSchema>;

/** One row per signal. Values are affinities and can be negative. */
export const demographicsRowSchema = z.looseObject({
  entity_id: z.string(),
  query: z.looseObject({
    age: z.record(z.string(), z.number()).optional(),
    gender: z.record(z.string(), z.number()).optional(),
  }),
});
export type QlooDemographicsRow = z.infer<typeof demographicsRowSchema>;

export const heatmapPointSchema = z.looseObject({
  location: z.looseObject({
    latitude: z.number(),
    longitude: z.number(),
    geohash: z.string(),
  }),
  query: z.looseObject({
    affinity: z.number(),
    affinity_rank: z.number(),
    popularity: z.number(),
  }),
});
export type QlooHeatmapPoint = z.infer<typeof heatmapPointSchema>;

export const trendingPointSchema = z.looseObject({
  date: z.string(),
  /** 0 to 1. */
  population_percentile: z.number(),
  /** A number written as text. */
  population_rank: z.string(),
  population_rank_velocity: z.number(),
  velocity_fold_change: z.number(),
  population_percent_delta: z.number(),
});
export type QlooTrendingPoint = z.infer<typeof trendingPointSchema>;

const typeRowSchema = z.looseObject({ type: z.string() });

const envelope = {
  success: z.boolean().optional(),
  duration: z.number().optional(),
};

/** `/search` and `/entities`. */
export const entityListResponseSchema = z.looseObject({
  ...envelope,
  results: z.array(entitySchema),
});

/** `/v2/insights` for any `urn:entity:*` type, and the locality heatmap. */
export const entityInsightsResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ entities: z.array(entitySchema) }),
});

/** `/v2/tags`. */
export const tagLookupResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ tags: z.array(tagLookupSchema) }),
});

/** `/v2/insights` with `filter.type=urn:tag`. */
export const tagInsightsResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ tags: z.array(tagSchema) }),
});

export const demographicsResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ demographics: z.array(demographicsRowSchema) }),
});

/** `/v2/insights` with `filter.type=urn:heatmap` and the default geohash boundary. */
export const heatmapResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ heatmap: z.array(heatmapPointSchema) }),
});

export const audiencesResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ audiences: z.array(audienceSchema) }),
});

export const tagTypesResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ tag_types: z.array(typeRowSchema) }),
});

export const audienceTypesResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ audience_types: z.array(typeRowSchema) }),
});

/**
 * `results.tags` are the tags the two groups share, each with `query.score`. `results.a` and
 * `results.b` are each group's own tags, with `query.count`. They are not limited by `take`.
 */
export const compareResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({
    tags: z.array(tagSchema),
    a: z.array(tagSchema),
    b: z.array(tagSchema),
  }),
});

export const trendingResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ trending: z.array(trendingPointSchema) }),
});

export type EntityListResponse = z.infer<typeof entityListResponseSchema>;
export type EntityInsightsResponse = z.infer<typeof entityInsightsResponseSchema>;
export type TagLookupResponse = z.infer<typeof tagLookupResponseSchema>;
export type TagInsightsResponse = z.infer<typeof tagInsightsResponseSchema>;
export type DemographicsResponse = z.infer<typeof demographicsResponseSchema>;
export type HeatmapResponse = z.infer<typeof heatmapResponseSchema>;
export type AudiencesResponse = z.infer<typeof audiencesResponseSchema>;
export type TagTypesResponse = z.infer<typeof tagTypesResponseSchema>;
export type AudienceTypesResponse = z.infer<typeof audienceTypesResponseSchema>;
export type CompareResponse = z.infer<typeof compareResponseSchema>;
export type TrendingResponse = z.infer<typeof trendingResponseSchema>;
