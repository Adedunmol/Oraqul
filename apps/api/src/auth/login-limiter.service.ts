import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { loginFailures } from '../db/schema.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_ACCOUNT_AND_IP = 5;
const MAX_FAILURES_PER_IP = 20;

/**
 * Counts wrong passwords per email and address, and per address alone. The pair limit stops
 * guessing at one account; the address limit stops one machine trying many accounts. Keying the
 * pair on the address too means a stranger cannot lock the real owner out. Unknown emails are
 * counted like known ones, so the limit does not reveal which accounts exist.
 */
@Injectable()
export class LoginLimiterService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async assertAllowed(email: string, ip: string): Promise<void> {
    const since = new Date(Date.now() - WINDOW_MS);
    const [counts] = await this.db
      .select({
        pair: sql<number>`count(*) filter (where ${loginFailures.email} = ${email})::int`,
        ip: sql<number>`count(*)::int`,
      })
      .from(loginFailures)
      .where(and(eq(loginFailures.ip, ip), gt(loginFailures.createdAt, since)));
    if (
      (counts?.pair ?? 0) >= MAX_FAILURES_PER_ACCOUNT_AND_IP ||
      (counts?.ip ?? 0) >= MAX_FAILURES_PER_IP
    ) {
      throw new HttpException(
        'Too many sign in attempts. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    await this.db.insert(loginFailures).values({ email, ip });
    await this.db
      .delete(loginFailures)
      .where(lt(loginFailures.createdAt, new Date(Date.now() - WINDOW_MS)));
  }

  async clear(email: string, ip: string): Promise<void> {
    await this.db
      .delete(loginFailures)
      .where(and(eq(loginFailures.email, email), eq(loginFailures.ip, ip)));
  }
}
