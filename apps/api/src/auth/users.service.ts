import { Inject, Injectable } from '@nestjs/common';
import type { oauthProviders } from '@oraqul/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { memberships, oauthAccounts, teams, users } from '../db/schema.js';
import type { SessionUser } from './session.guard.js';

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByEmail(email: string): Promise<SessionUser | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  /**
   * The one place accounts are linked: a verified email always maps to one user, whichever
   * sign in method proved it. Callers must have verified the email before calling.
   * A new account gets a personal team it owns, in the same transaction.
   */
  async findOrCreateVerified(email: string, name: string): Promise<SessionUser> {
    // Only the request that wins the insert gets a row back, so a race creates one team.
    const created = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name })
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (!user) return undefined;
      const [team] = await tx
        .insert(teams)
        .values({ name: `${user.name}'s team` })
        .returning({ id: teams.id });
      if (!team) {
        throw new Error(`Personal team for ${email} was not created`);
      }
      await tx.insert(memberships).values({ teamId: team.id, userId: user.id, role: 'owner' });
      return user;
    });
    if (created) return created;

    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error(`User ${email} vanished after insert`);
    }
    return user;
  }

  async findOrLinkOAuth(
    provider: (typeof oauthProviders)[number],
    providerUserId: string,
    email: string,
    name: string,
  ): Promise<SessionUser> {
    const [linked] = await this.db
      .select({ user: users })
      .from(oauthAccounts)
      .innerJoin(users, eq(users.id, oauthAccounts.userId))
      .where(
        and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)),
      )
      .limit(1);
    if (linked) {
      return linked.user;
    }

    const user = await this.findOrCreateVerified(email, name);
    await this.db
      .insert(oauthAccounts)
      .values({ userId: user.id, provider, providerUserId })
      .onConflictDoNothing();
    return user;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  /** A signup code must not overwrite the password of an account that already has one. */
  async setPasswordIfMissing(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.id, userId), isNull(users.passwordHash)));
  }
}
