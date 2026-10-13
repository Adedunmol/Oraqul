import { type InvitePreview, invitePreviewSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getInvite(token: string): Promise<InvitePreview> {
  return serverGet(`/invites/${encodeURIComponent(token)}`, invitePreviewSchema, {
    returnTo: `/invite/${token}`,
  });
}
