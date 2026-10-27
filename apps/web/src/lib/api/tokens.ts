import {
  type ApiToken,
  type ApiTokensResponse,
  apiTokensResponseSchema,
  type CreatedToken,
  type CreateToken,
  createdTokenSchema,
} from '@oraqul/schema';
import { clientRequest } from './client';

/** Makes a token. The token itself is in this answer only: the API keeps its hash. */
export function createToken(teamId: string, body: CreateToken): Promise<CreatedToken> {
  return clientRequest(`/teams/${teamId}/tokens`, { method: 'POST', body }, createdTokenSchema);
}

export async function revokeToken(teamId: string, tokenId: string): Promise<ApiToken[]> {
  const { tokens } = await clientRequest(
    `/teams/${teamId}/tokens/${tokenId}`,
    { method: 'DELETE' },
    apiTokensResponseSchema,
  );
  return tokens;
}
