import type { QlooClient, QlooResult } from '../client';
import { type EntityInsightsResponse, entityInsightsResponseSchema } from '../responses';
import type { EntityInsightsRequest } from './filters';

/**
 * `/v2/insights` for one entity type: what is closest to the signal, as a ranked list of
 * entities. `filter.type` picks the parameters you may use, so a book filter on a movie
 * request does not compile.
 */
export function entities(
  client: QlooClient,
  request: EntityInsightsRequest,
): Promise<QlooResult<EntityInsightsResponse>> {
  return client.get('/v2/insights', request, entityInsightsResponseSchema);
}
