import type { QlooClient, QlooResult } from '../client';
import { hasParam } from '../params';
import { type DemographicsResponse, demographicsResponseSchema } from '../responses';
import type { SignalParams } from './filters';

export type DemographicsRequest = Pick<
  SignalParams,
  'signal.interests.entities' | 'signal.interests.tags'
>;

/**
 * `urn:demographics`: age and gender skew as affinities that can be negative, one row per signal
 * and not averaged by Qloo.
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
