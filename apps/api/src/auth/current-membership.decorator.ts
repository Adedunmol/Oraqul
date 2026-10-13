import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Membership, TeamRequest } from './roles.guard.js';

/** The caller's membership in the route's team. Only set on routes behind RolesGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: undefined, context: ExecutionContext): Membership =>
    context.switchToHttp().getRequest<TeamRequest>().membership,
);
