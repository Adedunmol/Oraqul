import type { QlooEntityType } from '@oraqul/schema';
import type { QlooClient, QlooResult } from './client';
import type { QlooParams } from './params';
import {
  type EntityListResponse,
  entityListResponseSchema,
  type TagLookupResponse,
  type TagTypesResponse,
  tagLookupResponseSchema,
  tagTypesResponseSchema,
} from './responses';
import type { AudienceParentType, ExternalIdSource, SearchSortBy, SetOperator } from './urns';

type Page = { take?: number; page?: number };

export type SearchParams = Page & {
  query: string;
  types?: QlooEntityType[];
  /** `latitude,longitude`, a WKT shape, or a Qloo entity id. */
  'filter.location'?: string;
  /** Miles, up to 100. Only for types with a location. */
  'filter.radius'?: number;
  'filter.tags'?: string[];
  'operator.filter.tags'?: SetOperator;
  /** Minimum popularity, 0 to 1. */
  'filter.popularity'?: number;
  /** Minimum rating, 0 to 5. */
  'filter.rating'?: number;
  'filter.address'?: string;
  /** Existence checks such as `external.resy`. */
  'filter.exists'?: string[];
  sort_by?: SearchSortBy;
};

/** `/search`: text to entities. Score the candidates yourself, do not trust the first one. */
export function search(
  client: QlooClient,
  params: SearchParams,
): Promise<QlooResult<EntityListResponse>> {
  return client.get('/search', params, entityListResponseSchema);
}

/** `/entities`: entities by Qloo id. Also where `popularity` is read for a known title. */
export function entities(
  client: QlooClient,
  entityIds: string[],
): Promise<QlooResult<EntityListResponse>> {
  if (entityIds.length === 0) throw new Error('entities needs at least one entity id');
  // Sorted so the same set of ids always shares one cache entry.
  return client.get('/entities', { entity_ids: [...entityIds].sort() }, entityListResponseSchema);
}

/**
 * `/entities` by an id from another catalogue, for example an IMDb id for a film. An exact id
 * beats a name search when the user can supply one.
 */
export function entitiesByExternalId(
  client: QlooClient,
  source: ExternalIdSource,
  ids: string[],
): Promise<QlooResult<EntityListResponse>> {
  if (ids.length === 0) throw new Error('entitiesByExternalId needs at least one id');
  const params: QlooParams = { [`external.${source}.ids`]: [...ids].sort() };
  return client.get('/entities', params, entityListResponseSchema);
}

export type TagSearchParams = Page & {
  /** Partial text match on the tag name. */
  'filter.query'?: string;
  'filter.tag.types'?: string[];
  /** Entity types such as `urn:entity:brand` narrow a phrase to that type's tags. */
  'filter.parents.types'?: (AudienceParentType | QlooEntityType)[];
  'filter.results.tags'?: string[];
  'filter.popularity.min'?: number;
  'filter.popularity.max'?: number;
  'feature.typo_tolerance'?: boolean;
  /** Beta. Matches on meaning, not spelling. */
  'feature.semantic_search'?: boolean;
};

/** `/v2/tags`: a phrase to tag urns, for `filter.tags` and `signal.interests.tags`. */
export function tags(
  client: QlooClient,
  params: TagSearchParams,
): Promise<QlooResult<TagLookupResponse>> {
  return client.get('/v2/tags', params, tagLookupResponseSchema);
}

/** `/v2/tags/types`: the tag namespaces, for `filter.tag.types`. */
export function tagTypes(
  client: QlooClient,
  params: Page & { 'filter.parents.types'?: (AudienceParentType | QlooEntityType)[] } = {},
): Promise<QlooResult<TagTypesResponse>> {
  return client.get('/v2/tags/types', params, tagTypesResponseSchema);
}
