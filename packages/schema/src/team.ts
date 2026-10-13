import { z } from 'zod';
import { emailSchema } from './auth';
import { roleSchema } from './categories';

export const teamNameSchema = z.string().trim().min(1).max(80);

/** 32 random bytes as base64url. Checking the shape keeps junk out of the hash lookup. */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const createTeamSchema = z.object({ name: teamNameSchema });
export const changeRoleSchema = z.object({ role: roleSchema });
export const createInviteSchema = z.object({ email: emailSchema, role: roleSchema });

export const teamSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: roleSchema,
});
export const teamsResponseSchema = z.object({ teams: z.array(teamSummarySchema) });

export const memberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
});

export const inviteSummarySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  expiresAt: z.iso.datetime(),
});

export const teamDetailSchema = z.object({
  team: z.object({ id: z.uuid(), name: z.string() }),
  myRole: roleSchema,
  members: z.array(memberSchema),
  /** Only owners see pending invites. Everyone else gets an empty list. */
  invites: z.array(inviteSummarySchema),
});

export const inviteStatuses = ['pending', 'expired', 'accepted'] as const;

export const invitePreviewSchema = z.object({
  teamName: z.string(),
  invitedBy: z.string(),
  email: z.email(),
  role: roleSchema,
  status: z.enum(inviteStatuses),
  /** False when the signed in account's email is not the one that was invited. */
  emailMatches: z.boolean(),
});

export const acceptInviteResponseSchema = z.object({ teamId: z.uuid() });

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type TeamSummary = z.infer<typeof teamSummarySchema>;
export type TeamsResponse = z.infer<typeof teamsResponseSchema>;
export type Member = z.infer<typeof memberSchema>;
export type InviteSummary = z.infer<typeof inviteSummarySchema>;
export type TeamDetail = z.infer<typeof teamDetailSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;
