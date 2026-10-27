import { type ApiTokensResponse, apiTokensResponseSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getTokens(teamId: string, returnTo: string): Promise<ApiTokensResponse> {
  return serverGet(`/teams/${teamId}/tokens`, apiTokensResponseSchema, { returnTo });
}
