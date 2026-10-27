import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import { runs, users } from '../db/schema.js';

export interface RunAllowance {
  used: number;
  cap: number;
  /** The first day of next month, when the count starts again. */
  resetsOn: string;
}

const monthStart = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));

/**
 * How many runs a person may start a month. A run counts when it asked Qloo, because that is what
 * the quota is spent on: a router turn or a refused request costs nothing.
 */
@Injectable()
export class RunCapsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async allowance(userId: string, now: Date = new Date()): Promise<RunAllowance> {
    const [user] = await this.db
      .select({ cap: users.runCap })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [row] = await this.db
      .select({ used: sql<number>`count(*)::int` })
      .from(runs)
      .where(
        and(
          eq(runs.userId, userId),
          gte(runs.createdAt, monthStart(now)),
          sql`${runs.qlooCalls} > 0`,
        ),
      );
    const start = monthStart(now);
    const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return {
      used: row?.used ?? 0,
      cap: user?.cap ?? this.config.get('RUN_CAP_PER_USER_MONTH', { infer: true }),
      resetsOn: next.toISOString().slice(0, 10),
    };
  }

  /** The allowance when the person has used it all, else null. */
  async exceeded(userId: string, now: Date = new Date()): Promise<RunAllowance | null> {
    const allowance = await this.allowance(userId, now);
    return allowance.used >= allowance.cap ? allowance : null;
  }
}

export const capMessage = (a: RunAllowance): string =>
  `You have used this month's ${a.cap} runs. They reset on ${a.resetsOn}.`;
