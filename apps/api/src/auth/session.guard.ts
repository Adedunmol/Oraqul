import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import type { Request } from 'express';
import { type Database, DB } from '../db/db.module.js';
import { sessions, users } from '../db/schema.js';

export const SESSION_COOKIE = 'oraqul_session';

export const EMAIL_NOT_VERIFIED = 'email_not_verified';

export type SessionUser = typeof users.$inferSelect;
export type AuthedRequest = Request & { user: SessionUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const sessionId: unknown = request.signedCookies?.[SESSION_COOKIE];
    if (typeof sessionId !== 'string') {
      throw new UnauthorizedException();
    }

    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!row) {
      throw new UnauthorizedException();
    }

    request.user = row.user;
    return true;
  }
}

/**
 * Run after SessionGuard on routes that write. The `code` lets the web app tell this 403 from a
 * role refusal and offer to resend the confirmation instead of a dead end.
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        message: 'Confirm your email first',
        code: EMAIL_NOT_VERIFIED,
      });
    }
    return true;
  }
}
