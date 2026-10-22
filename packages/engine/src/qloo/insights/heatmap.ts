import type { QlooClient, QlooResult } from '../client';
import { hasParam } from '../params';
import { type HeatmapResponse, heatmapResponseSchema } from '../responses';
import type { HeatmapDimension } from '../urns';
import type { EntityBaseParams, SignalParams } from './filters';

type Place =
  | { 'filter.location': string; 'filter.location.query'?: never }
  | { 'filter.location.query': string; 'filter.location'?: never };

// `take` does not limit a heatmap: `take: 20` returned 558 cells in a live check. Slice in code.
export type HeatmapRequest = Place &
  SignalParams &
  Pick<EntityBaseParams, 'bias.trends' | 'take'> & {
    /** Metres. */
    'filter.location.radius'?: number;
  };

export type GeohashHeatmapRequest = HeatmapRequest & {
  /** Extra per-cell columns. Geohash output only. */
  'heatmap.dimensions'?: HeatmapDimension[];
  'filter.dimensions.hotel_class'?: number[];
  'filter.dimensions.price_level'?: number[];
};

function assertAnchored(request: HeatmapRequest): void {
  if (
    !hasParam(request, 'signal.interests.entities') &&
    !hasParam(request, 'signal.interests.tags')
  ) {
    throw new Error('a heatmap needs signal.interests.entities or signal.interests.tags');
  }
}

/**
 * `/v2/insights` with `filter.type=urn:heatmap`: where the signal's audience concentrates, as
 * geohash cells with affinity, rank and popularity. Use this to rank places for a title.
 */
export function heatmap(
  client: QlooClient,
  request: GeohashHeatmapRequest,
): Promise<QlooResult<HeatmapResponse>> {
  assertAnchored(request);
  return client.get(
    '/v2/insights',
    { ...request, 'filter.type': 'urn:heatmap', 'output.heatmap.boundary': 'urn:geohash' },
    heatmapResponseSchema,
  );
}
