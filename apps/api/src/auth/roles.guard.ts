import { type CanActivate, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import type { Role } from '@oraqul/schema';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Viewers are read only, editors run the agent, owners manage members
 * (docs/product/spec.md section 7).
 *
 * TODO: look up the caller's membership for the team in the route and compare
 * with the @Roles() metadata. Denies everything until then.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException('Role checks are not implemented yet');
  }
}
