import type { QlooEntityType } from '@oraqul/schema';
import type { QlooClient, QlooResult } from './client';
import {
  type CompareResponse,
  compareResponseSchema,
  type TrendingResponse,
  trendingResponseSchema,
} from './responses';
import type { CompareModel, CompareSubtype } from './urns';

export type CompareRequest = {
  /** First group of entity ids. */
  a: string[];
  /** Second group of entity ids. */
  b: string[];
  'filter.type'?: QlooEntityType[];
  'filter.subtype'?: CompareSubtype;
  model?: CompareModel;
  'filter.location.query'?: string;
  /** Metres. */
  'filter.location.radius'?: number;
  take?: number;
  page?: number;
  offset?: number;
};

/**
 * `/v2/analysis/compare`: what two groups of entities share. One call gives the overlap, so
 * rival overlap and comp shelf comparisons must come from a single call, never two.
 */
export function compare(
  client: QlooClient,
  request: CompareRequest,
): Promise<QlooResult<CompareResponse>> {
  const { a, b, ...rest } = request;
  if (a.length === 0 || b.length === 0) throw new Error('compare needs entities on both sides');
  return client.get(
    '/v2/analysis/compare',
    { ...rest, 'a.signal.interests.entities': a, 'b.signal.interests.entities': b },
    compareResponseSchema,
  );
}

export type TrendingRequest = {
  'filter.type': QlooEntityType;
  /** Required: Qloo answers 400 without it. */
  'signal.interests.entities': string[];
  /**
   * `YYYY-MM-DD`. A 60 or 90 day window returned no points in a live check, and 180 days or
   * more did. Use a window of at least 180 days.
   */
  'filter.start_date': string;
  'filter.end_date': string;
  take?: number;
  page?: number;
  offset?: number;
};

/**
 * `/v2/trending`: weekly popularity rank, percentile and velocity over a date range, newest
 * first. Backs the `momentum` tool.
 */
export function trending(
  client: QlooClient,
  request: TrendingRequest,
): Promise<QlooResult<TrendingResponse>> {
  return client.get('/v2/trending', request, trendingResponseSchema);
}
