import { z } from 'zod';

// Personal access tokens for the hosted MCP server (spec §5.22). A token belongs to one person and
// one team, carries that person's role in the team at the time of every call, and is shown once:
// only its hash is stored.

export const tokenLifetimes = [30, 90, 365] as const;

export const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** Days until it stops working. */
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
});
export type CreateToken = z.infer<typeof createTokenSchema>;

export const apiTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** The first characters, so a person can tell tokens apart. Never enough to use one. */
  prefix: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ApiToken = z.infer<typeof apiTokenSchema>;

export const apiTokensResponseSchema = z.object({ tokens: z.array(apiTokenSchema) });
export type ApiTokensResponse = z.infer<typeof apiTokensResponseSchema>;

/** The answer to creating a token: the only time the token itself is returned. */
export const createdTokenSchema = z.object({
  token: z.string(),
  record: apiTokenSchema,
});
export type CreatedToken = z.infer<typeof createdTokenSchema>;
