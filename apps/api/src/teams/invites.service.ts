import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AcceptInviteResponse, InvitePreview, InviteSummary, Role } from '@oraqul/schema';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { EMAIL_SENDER, type EmailSender } from '../auth/email/email-sender.js';
import { inviteEmail } from '../auth/email/templates.js';
import type { SessionUser } from '../auth/session.guard.js';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import { invites, memberships, teams, users } from '../db/schema.js';

export const INVITE_TTL_DAYS = 7;
const MAX_INVITES_PER_HOUR = 20;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class InvitesService {
  private readonly webOrigin: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  /** Inviting an email that already has a pending invite replaces it, which is how to resend. */
  async create(
    teamId: string,
    inviter: SessionUser,
    input: { email: string; role: Role },
  ): Promise<InviteSummary> {
    const [member] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.teamId, teamId), eq(users.email, input.email)))
      .limit(1);
    if (member) {
      throw new ConflictException('That person is already on the team');
    }

    // Any account can own a team, so without a cap an owner could use us to email strangers.
    const [recent] = await this.db
      .select({ total: count() })
      .from(invites)
      .where(
        and(
          eq(invites.teamId, teamId),
          gt(invites.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );
    if ((recent?.total ?? 0) >= MAX_INVITES_PER_HOUR) {
      throw new HttpException(
        'Too many invites sent. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      throw new NotFoundException();
    }

    const token = randomBytes(32).toString('base64url');
    const invite = await this.db.transaction(async (tx) => {
      await tx
        .delete(invites)
        .where(
          and(
            eq(invites.teamId, teamId),
            eq(invites.email, input.email),
            isNull(invites.acceptedAt),
          ),
        );
      const [row] = await tx
        .insert(invites)
        .values({
          teamId,
          email: input.email,
          role: input.role,
          tokenHash: hashToken(token),
          invitedBy: inviter.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        })
        .returning();
      if (!row) {
        throw new Error('Invite was not created');
      }
      return row;
    });

    try {
      await this.email.send(
        inviteEmail(input.email, {
          teamName: team.name,
          invitedBy: inviter.name,
          role: input.role,
          link: new URL(`/invite/${token}`, this.webOrigin).toString(),
          days: INVITE_TTL_DAYS,
        }),
      );
    } catch (error) {
      // An invite nobody received would sit in the pending list looking sent.
      await this.db.delete(invites).where(eq(invites.id, invite.id));
      throw error;
    }

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  /** Takes back a pending invite, so its link stops working. */
  async revoke(teamId: string, inviteId: string): Promise<void> {
    const removed = await this.db
      .delete(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.teamId, teamId), isNull(invites.acceptedAt)))
      .returning({ id: invites.id });
    if (removed.length === 0) {
      throw new NotFoundException();
    }
  }

  async preview(token: string, user: SessionUser): Promise<InvitePreview> {
    const [row] = await this.db
      .select({
        teamName: teams.name,
        invitedBy: users.name,
        email: invites.email,
        role: invites.role,
        expiresAt: invites.expiresAt,
        acceptedAt: invites.acceptedAt,
      })
      .from(invites)
      .innerJoin(teams, eq(teams.id, invites.teamId))
      .innerJoin(users, eq(users.id, invites.invitedBy))
      .where(eq(invites.tokenHash, hashToken(token)))
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }

    const status = row.acceptedAt
      ? 'accepted'
      : row.expiresAt <= new Date()
        ? 'expired'
        : 'pending';
    return {
      teamName: row.teamName,
      invitedBy: row.invitedBy,
      email: row.email,
      role: row.role,
      status,
      emailMatches: row.email === user.email,
    };
  }

  /**
   * The email check comes before the invite is used up, so opening someone else's link while
   * signed in does not burn it. Someone who is already a member keeps their current role.
   */
  async accept(token: string, user: SessionUser): Promise<AcceptInviteResponse> {
    return this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(invites)
        .where(eq(invites.tokenHash, hashToken(token)))
        .limit(1);
      if (!invite) {
        throw new NotFoundException();
      }
      if (invite.email !== user.email) {
        throw new ForbiddenException('This invite is for a different email address');
      }

      const [used] = await tx
        .update(invites)
        .set({ acceptedAt: new Date() })
        .where(
          and(
            eq(invites.id, invite.id),
            isNull(invites.acceptedAt),
            gt(invites.expiresAt, new Date()),
          ),
        )
        .returning({ id: invites.id });
      if (!used) {
        throw new GoneException('This invite has expired or was already used');
      }

      await tx
        .insert(memberships)
        .values({ teamId: invite.teamId, userId: user.id, role: invite.role })
        .onConflictDoNothing({ target: [memberships.teamId, memberships.userId] });
      return { teamId: invite.teamId };
    });
  }
}
