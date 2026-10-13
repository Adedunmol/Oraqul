import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequest, SessionUser } from './session.guard.js';

export const CurrentUser = createParamDecorator(
  (_data: undefined, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);
