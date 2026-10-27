import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Role, TeamDetail, TeamSummary } from '@oraqul/schema';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { invites, memberships, teams, users } from '../db/schema.js';

@Injectable()
export class TeamsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(userId: string): Promise<TeamSummary[]> {
    return this.db
      .select({ id: teams.id, name: teams.name, role: memberships.role })
      .from(memberships)
      .innerJoin(teams, eq(teams.id, memberships.teamId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.createdAt));
  }

  create(userId: string, name: string): Promise<TeamSummary> {
    return this.db.transaction(async (tx) => {
      const [team] = await tx.insert(teams).values({ name }).returning();
      if (!team) {
        throw new Error('Team was not created');
      }
      await tx.insert(memberships).values({ teamId: team.id, userId, role: 'owner' });
      return { id: team.id, name: team.name, role: 'owner' };
    });
  }

  async detail(teamId: string, myRole: Role): Promise<TeamDetail> {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      throw new NotFoundException();
    }
    const members = await this.db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.teamId, teamId))
      .orderBy(asc(memberships.createdAt));
    const pending =
      myRole === 'owner'
        ? await this.db
            .select({
              id: invites.id,
              email: invites.email,
              role: invites.role,
              expiresAt: invites.expiresAt,
            })
            .from(invites)
            .where(
              and(
                eq(invites.teamId, teamId),
                isNull(invites.acceptedAt),
                gt(invites.expiresAt, new Date()),
              ),
            )
            .orderBy(asc(invites.createdAt))
        : [];

    return {
      team: { id: team.id, name: team.name },
      myRole,
      members: members.map((member) => ({ ...member, joinedAt: member.joinedAt.toISOString() })),
      invites: pending.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString() })),
    };
  }

  async rename(teamId: string, name: string): Promise<void> {
    const renamed = await this.db
      .update(teams)
      .set({ name })
      .where(eq(teams.id, teamId))
      .returning({ id: teams.id });
    if (renamed.length === 0) {
      throw new NotFoundException();
    }
  }

  async changeRole(teamId: string, userId: string, role: Role): Promise<void> {
    await this.db.transaction(async (tx) => {
      const owners = await this.lockOwners(tx, teamId);
      const isOwner = owners.includes(userId);
      if (isOwner && role !== 'owner' && owners.length === 1) {
        throw new ConflictException('A team needs at least one owner');
      }
      const changed = await tx
        .update(memberships)
        .set({ role })
        .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)))
        .returning({ id: memberships.id });
      if (changed.length === 0) {
        throw new NotFoundException();
      }
    });
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const owners = await this.lockOwners(tx, teamId);
      if (owners.length === 1 && owners.includes(userId)) {
        throw new ConflictException('A team needs at least one owner');
      }
      const removed = await tx
        .delete(memberships)
        .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)))
        .returning({ id: memberships.id });
      if (removed.length === 0) {
        throw new NotFoundException();
      }
    });
  }

  // Locks the team's owner rows until the transaction ends, so two owners cannot demote or
  // remove each other at the same moment and leave the team with none.
  private async lockOwners(tx: Pick<Database, 'select'>, teamId: string): Promise<string[]> {
    const rows = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.teamId, teamId), eq(memberships.role, 'owner')))
      .for('update');
    return rows.map((row) => row.userId);
  }
}
