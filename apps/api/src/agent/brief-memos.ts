import { and, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../db/db.module.js';
import { briefMemos } from '../db/schema.js';
import type { BriefMemos } from './launch/memo.js';

/** How long a choice is kept. After this the model is asked again, so a better prompt or data shows up. */
const KEEP_DAYS = 21;

/** Brief memos in Postgres, shared by every project and run. */
export class DbBriefMemos implements BriefMemos {
  constructor(private readonly db: Database) {}

  async get(key: string) {
    const [row] = await this.db
      .select({ value: briefMemos.value })
      .from(briefMemos)
      .where(
        and(
          eq(briefMemos.key, key),
          gt(briefMemos.createdAt, sql`now() - make_interval(days => ${KEEP_DAYS})`),
        ),
      )
      .limit(1);
    return row?.value ?? null;
  }

  async set(key: string, kind: string, value: unknown) {
    await this.db
      .insert(briefMemos)
      .values({ key, kind, value })
      .onConflictDoUpdate({
        target: briefMemos.key,
        set: { value, kind, createdAt: sql`now()` },
      });
  }
}
