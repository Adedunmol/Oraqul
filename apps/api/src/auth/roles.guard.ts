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
import { memberships } from '../db/schema.js';
import type { AuthedRequest } from './session.guard.js';

export const ROLES_KEY = 'roles';

/** The roles allowed to call the route, listed in full: there is no ranking between roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type Membership = { teamId: string; userId: string; role: Role };
export type TeamRequest = AuthedRequest & { membership: Membership };

/**
 * Checks the caller's role in the team named by the `:teamId` route param against @Roles()
 * (roles per action: docs/product/spec.md section 7). Run it after SessionGuard, which sets
 * `request.user`. A route without @Roles() is denied, so forgetting one fails closed.
 * Every refusal is the same 403, so the answer does not say whether a team exists.
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
    const teamId = z.uuid().safeParse(request.params.teamId);
    if (!allowed || !teamId.success) {
      throw new ForbiddenException();
    }

    const [row] = await this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.teamId, teamId.data), eq(memberships.userId, request.user.id)))
      .limit(1);
    if (!row || !allowed.includes(row.role)) {
      throw new ForbiddenException();
    }

    request.membership = { teamId: teamId.data, userId: request.user.id, role: row.role };
    return true;
  }
}
