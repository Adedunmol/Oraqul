import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApiToken, CreatedToken, CreateToken, Role } from '@oraqul/schema';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { apiTokens, memberships, users } from '../db/schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Who a token speaks for on this call: its person, its team and their role in it right now. */
export interface Principal {
  tokenId: string;
  userId: string;
  teamId: string;
  role: Role;
  emailVerified: boolean;
}

type Row = typeof apiTokens.$inferSelect;

const view = (r: Row): ApiToken => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  expiresAt: r.expiresAt.toISOString(),
  revokedAt: r.revokedAt?.toISOString() ?? null,
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Personal access tokens for the hosted MCP server. A token is 32 random bytes shown once; only its
 * hash is stored. Every call looks the token up again and reads the person's live membership, so a
 * revoked or expired token, a removed member or a lowered role takes effect on the next call.
 */
@Injectable()
export class TokensService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(
    userId: string,
    teamId: string,
    input: CreateToken,
    now: Date = new Date(),
  ): Promise<CreatedToken> {
    const token = `oraq_${randomBytes(32).toString('base64url')}`;
    const [row] = await this.db
      .insert(apiTokens)
      .values({
        userId,
        teamId,
        name: input.name,
        prefix: token.slice(0, 9),
        tokenHash: hash(token),
        expiresAt: new Date(now.getTime() + input.expiresInDays * DAY_MS),
      })
      .returning();
    if (!row) throw new Error('Token insert returned no row');
    return { token, record: view(row) };
  }

  /** A person's own tokens for the team, newest first, with the revoked ones. */
  async list(userId: string, teamId: string): Promise<ApiToken[]> {
    const rows = await this.db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), eq(apiTokens.teamId, teamId)))
      .orderBy(desc(apiTokens.createdAt));
    return rows.map(view);
  }

  /** Revokes one of the person's own tokens. It stops working on its next call. */
  async revoke(
    userId: string,
    teamId: string,
    tokenId: string,
    now: Date = new Date(),
  ): Promise<ApiToken[]> {
    const [row] = await this.db
      .update(apiTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(apiTokens.id, tokenId),
          eq(apiTokens.userId, userId),
          eq(apiTokens.teamId, teamId),
          isNull(apiTokens.revokedAt),
        ),
      )
      .returning({ id: apiTokens.id });
    if (!row) throw new NotFoundException('No such token');
    return this.list(userId, teamId);
  }

  /** The person behind a token, or null for a wrong, revoked or expired token or a person no longer on the team. */
  async authenticate(raw: string, now: Date = new Date()): Promise<Principal | null> {
    const [row] = await this.db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        teamId: apiTokens.teamId,
        revokedAt: apiTokens.revokedAt,
        expiresAt: apiTokens.expiresAt,
        role: memberships.role,
        verified: users.emailVerifiedAt,
      })
      .from(apiTokens)
      .innerJoin(
        memberships,
        and(eq(memberships.userId, apiTokens.userId), eq(memberships.teamId, apiTokens.teamId)),
      )
      .innerJoin(users, eq(users.id, apiTokens.userId))
      .where(eq(apiTokens.tokenHash, hash(raw)))
      .limit(1);
    if (!row || row.revokedAt || row.expiresAt <= now) return null;
    // Recorded at most once a minute, so a busy client does not write on every call.
    await this.db
      .update(apiTokens)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(apiTokens.id, row.id),
          or(
            isNull(apiTokens.lastUsedAt),
            lt(apiTokens.lastUsedAt, new Date(now.getTime() - 60_000)),
          ),
        ),
      );
    return {
      tokenId: row.id,
      userId: row.userId,
      teamId: row.teamId,
      role: row.role,
      emailVerified: Boolean(row.verified),
    };
  }
}
