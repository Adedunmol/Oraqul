import {
  type CreateInviteInput,
  emptyResponseSchema,
  type InviteSummary,
  inviteSummarySchema,
  type Role,
  type TeamSummary,
  teamSummarySchema,
} from '@oraqul/schema';
import { clientRequest } from './client';

export function createTeam(name: string): Promise<TeamSummary> {
  return clientRequest('/teams', { method: 'POST', body: { name } }, teamSummarySchema);
}

export function changeMemberRole(teamId: string, userId: string, role: Role): Promise<void> {
  return clientRequest(
    `/teams/${teamId}/members/${userId}`,
    { method: 'PATCH', body: { role } },
    emptyResponseSchema,
  );
}

export function removeMember(teamId: string, userId: string): Promise<void> {
  return clientRequest(
    `/teams/${teamId}/members/${userId}`,
    { method: 'DELETE' },
    emptyResponseSchema,
  );
}

export function inviteMember(teamId: string, input: CreateInviteInput): Promise<InviteSummary> {
  return clientRequest(
    `/teams/${teamId}/invites`,
    { method: 'POST', body: input },
    inviteSummarySchema,
  );
}

export function renameTeam(teamId: string, name: string): Promise<void> {
  return clientRequest(
    `/teams/${teamId}`,
    { method: 'PATCH', body: { name } },
    emptyResponseSchema,
  );
}

export function revokeInvite(teamId: string, inviteId: string): Promise<void> {
  return clientRequest(
    `/teams/${teamId}/invites/${inviteId}`,
    { method: 'DELETE' },
    emptyResponseSchema,
  );
}
