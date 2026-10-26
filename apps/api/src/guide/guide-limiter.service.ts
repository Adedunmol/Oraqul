import { createHmac } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, gt, lt, sql } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import { guideQuestions } from '../db/schema.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Keeps the public help bot inside a free quota: a limit per visitor per hour so one machine cannot
 * use it all, and a cap for everyone per day so the quota cannot run out. A visitor is a keyed
 * hash of the address, so no address is stored. The check and the count are two statements, so a
 * burst of parallel requests can overshoot by a few; the cap is a budget, not a security boundary.
 */
@Injectable()
export class GuideLimiterService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private visitorOf(ip: string): string {
    return createHmac('sha256', this.config.get('SESSION_SECRET', { infer: true }))
      .update(ip)
      .digest('hex')
      .slice(0, 32);
  }

  async admit(ip: string): Promise<void> {
    const visitor = this.visitorOf(ip);
    const now = Date.now();
    await this.db
      .delete(guideQuestions)
      .where(lt(guideQuestions.createdAt, new Date(now - DAY_MS)));
    const [counts] = await this.db
      .select({
        visitor: sql<number>`count(*) filter (where ${guideQuestions.visitor} = ${visitor} and ${guideQuestions.createdAt} > ${new Date(now - HOUR_MS)})::int`,
        everyone: sql<number>`count(*)::int`,
      })
      .from(guideQuestions)
      .where(gt(guideQuestions.createdAt, new Date(now - DAY_MS)));
    if ((counts?.everyone ?? 0) >= this.config.get('GUIDE_BOT_DAILY_CAP', { infer: true })) {
      throw new HttpException(
        'The guide assistant has answered all it can today.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if ((counts?.visitor ?? 0) >= this.config.get('GUIDE_BOT_HOURLY_LIMIT', { infer: true })) {
      throw new HttpException(
        'You have asked a lot of questions this hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.db.insert(guideQuestions).values({ visitor });
  }

  /** Gives a question back when the model could not answer it, so a failure costs nobody a turn. */
  async refund(ip: string): Promise<void> {
    const visitor = this.visitorOf(ip);
    const [latest] = await this.db
      .select({ id: guideQuestions.id })
      .from(guideQuestions)
      .where(eq(guideQuestions.visitor, visitor))
      .orderBy(sql`${guideQuestions.createdAt} desc`)
      .limit(1);
    if (latest) await this.db.delete(guideQuestions).where(eq(guideQuestions.id, latest.id));
  }
}
