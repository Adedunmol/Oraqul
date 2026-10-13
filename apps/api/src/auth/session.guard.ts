import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import type { Request } from 'express';
import { type Database, DB } from '../db/db.module.js';
import { sessions, users } from '../db/schema.js';

export const SESSION_COOKIE = 'oraqul_session';

export type SessionUser = typeof users.$inferSelect;
export type AuthedRequest = Request & { user: SessionUser };

/** Reads the signed session cookie and attaches the user to the request. */
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
