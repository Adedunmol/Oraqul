import { type AcceptInviteResponse, acceptInviteResponseSchema } from '@oraqul/schema';
import { clientRequest } from './client';

export function acceptInvite(token: string): Promise<AcceptInviteResponse> {
  return clientRequest(
    `/invites/${encodeURIComponent(token)}/accept`,
    { method: 'POST' },
    acceptInviteResponseSchema,
  );
}
