import type { QlooClient, QlooResult } from '../client';
import { hasParam } from '../params';
import { type DemographicsResponse, demographicsResponseSchema } from '../responses';
import type { SignalParams } from './filters';

export type DemographicsRequest = Pick<
  SignalParams,
  'signal.interests.entities' | 'signal.interests.tags'
>;

/**
 * `/v2/insights` with `filter.type=urn:demographics`: how age and gender skew for the signal,
 * as affinities that can be negative. Returns one row per signal, so several entities in one
 * request are not averaged by Qloo.
 */
export function demographics(
  client: QlooClient,
  request: DemographicsRequest,
): Promise<QlooResult<DemographicsResponse>> {
  if (
    !hasParam(request, 'signal.interests.entities') &&
    !hasParam(request, 'signal.interests.tags')
  ) {
    throw new Error('demographics needs signal.interests.entities or signal.interests.tags');
  }
  return client.get(
    '/v2/insights',
    { ...request, 'filter.type': 'urn:demographics' },
    demographicsResponseSchema,
  );
}
