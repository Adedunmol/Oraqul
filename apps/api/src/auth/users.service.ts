import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { oauthProviders } from '@oraqul/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { memberships, oauthAccounts, sessions, teams, users } from '../db/schema.js';
import type { SessionUser } from './session.guard.js';

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByEmail(email: string): Promise<SessionUser | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  /**
   * The one place accounts are created or found. A verified email maps to one user, whichever sign
   * in method proved it, so callers must have verified it. A new account gets a personal team in
   * the same transaction.
   */
  async findOrCreateVerified(email: string, name: string): Promise<SessionUser> {
    const created = await this.insertWithTeam({ email, name, emailVerifiedAt: new Date() });
    if (created) return created;

    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error(`User ${email} vanished after insert`);
    }
    return this.markVerified(user);
  }

  /**
   * Makes the account of someone who signed up with a password and has not confirmed the address
   * yet. Throws 409 when the email is taken, which tells a stranger the address has an account;
   * that is the standard trade for a signup that works straight away.
   */
  async createUnverified(email: string, name: string, passwordHash: string): Promise<SessionUser> {
    const created = await this.insertWithTeam({ email, name, passwordHash });
    if (!created) {
      throw new ConflictException('An account with this email already exists');
    }
    return created;
  }

  /**
   * Called when a method that proves the address (Google, an emailed code) reaches an account that
   * had not confirmed it. The password it holds was chosen by whoever typed the address at signup,
   * who may not own it, so it is dropped along with any session that person started.
   */
  async markVerified(user: SessionUser): Promise<SessionUser> {
    if (user.emailVerifiedAt) return user;
    const [verified] = await this.db
      .update(users)
      .set({ emailVerifiedAt: new Date(), passwordHash: null })
      .where(and(eq(users.id, user.id), isNull(users.emailVerifiedAt)))
      .returning();
    if (!verified) return (await this.findByEmail(user.email)) ?? user;
    await this.db.delete(sessions).where(eq(sessions.userId, user.id));
    return verified;
  }

  /** The owner confirmed the address with the code sent to the signup. The password they chose stays. */
  async confirmSignupEmail(user: SessionUser): Promise<SessionUser> {
    if (user.emailVerifiedAt) return user;
    const [verified] = await this.db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(and(eq(users.id, user.id), isNull(users.emailVerifiedAt)))
      .returning();
    return verified ?? (await this.findByEmail(user.email)) ?? user;
  }

  // Only the request that wins the insert gets a row back, so a race creates one team.
  private insertWithTeam(values: typeof users.$inferInsert): Promise<SessionUser | undefined> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values(values)
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (!user) return undefined;
      const [team] = await tx
        .insert(teams)
        .values({ name: `${user.name}'s team` })
        .returning({ id: teams.id });
      if (!team) {
        throw new Error(`Personal team for ${values.email} was not created`);
      }
      await tx.insert(memberships).values({ teamId: team.id, userId: user.id, role: 'owner' });
      return user;
    });
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
}
