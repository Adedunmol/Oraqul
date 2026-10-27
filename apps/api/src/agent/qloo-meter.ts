import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { QlooMeter } from '@oraqul/engine';
import { lt, sql } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import { qlooUsage } from '../db/schema.js';
import type { RunVia } from './run-origin.js';

export const monthOf = (at: Date): string => at.toISOString().slice(0, 7);

/**
 * The month's Qloo budget, shared by every run and kept in Postgres so a restart does not reset it.
 * A person in the web app may use all of it. Connected agents and launch watches stop short of the
 * reserve, so background work never leaves interactive use with no calls.
 */
@Injectable()
export class QlooMeterService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** The most calls a run from `via` may push the month's count to. */
  limitFor(via: RunVia): number {
    const total = this.config.get('QLOO_MONTHLY_BUDGET', { infer: true });
    if (via === 'web') return total;
    return Math.max(0, total - this.config.get('QLOO_INTERACTIVE_RESERVE', { infer: true }));
  }

  /** Counts one call when the month has room for it. One statement, so runs cannot overshoot together. */
  async take(via: RunVia, now: Date = new Date()): Promise<boolean> {
    const limit = this.limitFor(via);
    if (limit <= 0) return false;
    const rows = await this.db
      .insert(qlooUsage)
      .values({ month: monthOf(now), calls: 1 })
      .onConflictDoUpdate({
        target: qlooUsage.month,
        set: { calls: sql`${qlooUsage.calls} + 1` },
        setWhere: lt(qlooUsage.calls, limit),
      })
      .returning({ calls: qlooUsage.calls });
    return rows.length > 0;
  }

  async used(now: Date = new Date()): Promise<number> {
    const [row] = await this.db
      .select({ calls: qlooUsage.calls })
      .from(qlooUsage)
      .where(sql`${qlooUsage.month} = ${monthOf(now)}`);
    return row?.calls ?? 0;
  }

  forOrigin(via: RunVia): QlooMeter {
    return { take: () => this.take(via) };
  }
}
