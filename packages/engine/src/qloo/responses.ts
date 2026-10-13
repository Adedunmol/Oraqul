import { z } from 'zod';

// Qloo responses are validated here, once. Objects are loose: fields we do not read are kept,
// and the whole body is stored on the call record as `returned`.
//
// Required fields are the ones every documented example carries. Anything the docs do not
// settle is optional with a TODO(verify), to be tightened after `qloo:smoke` with a real key.

export const tagSchema = z.looseObject({
  // TODO(verify): /v2/tags and urn:tag insights use `tag_id`; entity tags may use `id`.
  tag_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string(),
  subtype: z.string().optional(),
  query: z
    .looseObject({
      // `affinity` on urn:tag insights, `score` on compare. TODO(verify): compare shape.
      affinity: z.number().optional(),
      score: z.number().optional(),
      count: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});
export type QlooTag = z.infer<typeof tagSchema>;

export const entitySchema = z.looseObject({
  entity_id: z.string(),
  name: z.string(),
  subtype: z.string().optional(),
  popularity: z.number().optional(),
  properties: z.looseObject({}).optional(),
  tags: z.array(tagSchema).optional(),
  query: z
    .looseObject({
      affinity: z.number().optional(),
      explainability: z.json().optional(),
    })
    .optional(),
});
export type QlooEntity = z.infer<typeof entitySchema>;

export const audienceSchema = z.looseObject({
  // TODO(verify): which of the two ids Qloo sends.
  entity_id: z.string().optional(),
  id: z.string().optional(),
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
  population_percentile: z.number(),
  population_rank: z.number(),
  population_rank_velocity: z.number(),
  velocity_fold_change: z.number(),
  population_percent_delta: z.number(),
});
export type QlooTrendingPoint = z.infer<typeof trendingPointSchema>;

const envelope = {
  success: z.boolean().optional(),
  duration: z.number().optional(),
};

/** `/search` and `/entities`. */
export const entityListResponseSchema = z.looseObject({
  ...envelope,
  results: z.array(entitySchema),
});

/** `/v2/insights` for any `urn:entity:*` type. */
export const entityInsightsResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ entities: z.array(entitySchema) }),
});

/** `/v2/insights` with `filter.type=urn:tag`, and `/v2/tags`. */
export const tagsResponseSchema = z.looseObject({
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
  // TODO(verify): the docs show `results.entities`; Shelva's live calls read `results.audiences`.
  results: z.looseObject({ audiences: z.array(audienceSchema) }),
});

// TODO(verify): shapes not seen in the docs; `results` is not read until a real response is saved.
export const typesResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({}),
});

/**
 * TODO(verify): the docs describe an entity list, but Shelva's live calls read shared tags with
 * `query.score` in `results.tags` and each group's own tags in `results.a` and `results.b`.
 */
export const compareResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({
    tags: z.array(tagSchema).optional(),
    a: z.array(tagSchema).optional(),
    b: z.array(tagSchema).optional(),
  }),
});

export const trendingResponseSchema = z.looseObject({
  ...envelope,
  results: z.looseObject({ trending: z.array(trendingPointSchema) }),
});

export type EntityListResponse = z.infer<typeof entityListResponseSchema>;
export type EntityInsightsResponse = z.infer<typeof entityInsightsResponseSchema>;
export type TagsResponse = z.infer<typeof tagsResponseSchema>;
export type DemographicsResponse = z.infer<typeof demographicsResponseSchema>;
export type HeatmapResponse = z.infer<typeof heatmapResponseSchema>;
export type AudiencesResponse = z.infer<typeof audiencesResponseSchema>;
export type TypesResponse = z.infer<typeof typesResponseSchema>;
export type CompareResponse = z.infer<typeof compareResponseSchema>;
export type TrendingResponse = z.infer<typeof trendingResponseSchema>;
