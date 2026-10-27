import { and, count, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/db.module.js';
import { watchEvents, watches, watchReads } from '../db/schema.js';

/** Unread watch events per project for one person, across every watch in those projects. */
export async function watchUnreadByProject(
  db: Database,
  projectIds: string[],
  userId: string,
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db
    .select({ projectId: watches.projectId, unread: count(watchEvents.id) })
    .from(watches)
    .innerJoin(watchEvents, eq(watchEvents.watchId, watches.id))
    .leftJoin(watchReads, and(eq(watchReads.watchId, watches.id), eq(watchReads.userId, userId)))
    .where(
      and(
        inArray(watches.projectId, projectIds),
        gt(watchEvents.createdAt, sql`coalesce(${watchReads.seenThrough}, 'epoch'::timestamptz)`),
      ),
    )
    .groupBy(watches.projectId);
  return new Map(rows.map((r) => [r.projectId, Number(r.unread)]));
}
