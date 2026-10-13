import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import { sessions } from '../db/schema.js';
import { SESSION_COOKIE } from './session.guard.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  private readonly cookie: CookieOptions;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    // Domain is what lets the web app's server components receive the cookie (docs/architecture.md).
    this.cookie = {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.get('API_ORIGIN', { infer: true }).startsWith('https://'),
      domain: config.get('COOKIE_DOMAIN', { infer: true }) || undefined,
      path: '/',
    };
  }

  async create(userId: string, response: Response): Promise<void> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const [session] = await this.db
      .insert(sessions)
      .values({ userId, expiresAt })
      .returning({ id: sessions.id });
    if (!session) {
      throw new Error('Session insert returned no row');
    }
    response.cookie(SESSION_COOKIE, session.id, {
      ...this.cookie,
      signed: true,
      expires: expiresAt,
    });
  }

  async destroy(sessionId: unknown, response: Response): Promise<void> {
    if (typeof sessionId === 'string') {
      await this.db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    response.clearCookie(SESSION_COOKIE, this.cookie);
  }

  async destroyAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
