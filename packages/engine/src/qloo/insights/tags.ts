import type { QlooClient, QlooResult } from '../client';
import { hasParam } from '../params';
import { type TagsResponse, tagsResponseSchema } from '../responses';
import type { DiversifyBy } from '../urns';
import type { EntityBaseParams, SignalParams } from './filters';

// Parameters from the taste analysis guide. The Entity Type Parameter Guide's table for tags is
// shorter and lists no signals. TODO(verify) which of these Qloo applies.
export type TagInsightsRequest = SignalParams &
  Pick<EntityBaseParams, 'bias.trends' | 'take' | 'page' | 'offset'> & {
    /** A tag namespace such as `urn:tag:keyword:media`, from `lookup.tagTypes`. */
    'filter.tag.types'?: string[];
    /** Entity types whose tags to return, for example `urn:entity:movie`. */
    'filter.parents.types'?: string[];
    'signal.location'?: string;
    'signal.location.query'?: string;
    'diversify.by'?: Extract<DiversifyBy, 'subtype'>;
    'diversify.take'?: number;
  };

/**
 * `/v2/insights` with `filter.type=urn:tag`: the tags that best describe a signal. This is the
 * taste profile of an audience, a title or a place, and what `tagWeights` reads.
 */
export function tags(
  client: QlooClient,
  request: TagInsightsRequest,
): Promise<QlooResult<TagsResponse>> {
  const anchored = [
    'signal.interests.entities',
    'signal.interests.tags',
    'signal.demographics.audiences',
    'signal.location',
    'signal.location.query',
    'filter.tag.types',
    'filter.parents.types',
  ].some((key) => hasParam(request, key));
  if (!anchored) {
    throw new Error('tag insights need a signal, filter.tag.types or filter.parents.types');
  }
  return client.get('/v2/insights', { ...request, 'filter.type': 'urn:tag' }, tagsResponseSchema);
}
