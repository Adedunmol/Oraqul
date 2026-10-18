import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@oraqul/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, DB } from '../db/db.module.js';
import { memberships, outputs, projects, threads } from '../db/schema.js';
import type { AuthedRequest } from './session.guard.js';

export const ROLES_KEY = 'roles';

/** The roles allowed to call the route, listed in full: there is no ranking between roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type Membership = { teamId: string; userId: string; role: Role };
export type TeamRequest = AuthedRequest & { membership: Membership };

/**
 * Checks the caller's role in the route's team against @Roles() (spec §7); run it after
 * SessionGuard. A route without @Roles() is denied, so forgetting one fails closed. Every refusal
 * is the same 403, so the answer does not say whether a team exists.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<TeamRequest>();
    const teamId = allowed ? await this.teamOf(request.params) : null;
    if (!allowed || !teamId) {
      throw new ForbiddenException();
    }

    const [row] = await this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, request.user.id)))
      .limit(1);
    if (!row || !allowed.includes(row.role)) {
      throw new ForbiddenException();
    }

    request.membership = { teamId, userId: request.user.id, role: row.role };
    return true;
  }

  // The team the route acts in: `:teamId` itself, or the team that owns `:projectId`,
  // `:threadId` or `:outputId`. A malformed or unknown id gives null, which is the same 403 as no membership.
  private async teamOf(params: Record<string, unknown>): Promise<string | null> {
    const uuid = (value: unknown) => {
      const parsed = z.uuid().safeParse(value);
      return parsed.success ? parsed.data : null;
    };
    if (params.teamId !== undefined) return uuid(params.teamId);
    if (params.projectId !== undefined) {
      const projectId = uuid(params.projectId);
      if (!projectId) return null;
      const [row] = await this.db
        .select({ teamId: projects.teamId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      return row?.teamId ?? null;
    }
    if (params.threadId !== undefined) {
      const threadId = uuid(params.threadId);
      if (!threadId) return null;
      const [row] = await this.db
        .select({ teamId: projects.teamId })
        .from(threads)
        .innerJoin(projects, eq(projects.id, threads.projectId))
        .where(eq(threads.id, threadId))
        .limit(1);
      return row?.teamId ?? null;
    }
    if (params.outputId !== undefined) {
      const outputId = uuid(params.outputId);
      if (!outputId) return null;
      const [row] = await this.db
        .select({ teamId: projects.teamId })
        .from(outputs)
        .innerJoin(projects, eq(projects.id, outputs.projectId))
        .where(eq(outputs.id, outputId))
        .limit(1);
      return row?.teamId ?? null;
    }
    return null;
  }
}
