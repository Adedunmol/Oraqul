import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/test-database.js';
import { projects, runs, teams, threads, users } from '../db/schema.js';
import { capMessage, RunCapsService } from './run-caps.js';

describe('RunCapsService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let userId = '';
  let threadId = '';
  beforeAll(async () => {
    database = await createTestDatabase();
    const { db } = database;
    const [user] = await db.insert(users).values({ email: 'a@b.co', name: 'A' }).returning();
    const [team] = await db.insert(teams).values({ name: 'T' }).returning();
    const [project] = await db.insert(projects).values({ teamId: team!.id }).returning();
    const [thread] = await db
      .insert(threads)
      .values({ projectId: project!.id, name: 'x', createdBy: user!.id })
      .returning();
    userId = user!.id;
    threadId = thread!.id;
  });
  afterAll(() => database.close());

  const run = (qlooCalls: number, createdAt: Date) =>
    database.db.insert(runs).values({ threadId, agent: 'film', userId, qlooCalls, createdAt });

  it('counts only runs that asked Qloo, this month', async () => {
    const caps = new RunCapsService(
      database.db,
      new ConfigService({ RUN_CAP_PER_USER_MONTH: 2 }) as never,
    );
    const now = new Date('2026-10-15T12:00:00Z');
    await run(40, new Date('2026-10-03T00:00:00Z'));
    await run(0, new Date('2026-10-04T00:00:00Z'));
    await run(55, new Date('2026-09-28T00:00:00Z'));
    expect(await caps.exceeded(userId, now)).toBeNull();
    await run(12, new Date('2026-10-10T00:00:00Z'));
    const over = await caps.exceeded(userId, now);
    expect(over).toEqual({ used: 2, cap: 2, resetsOn: '2026-11-01' });
    expect(capMessage(over!)).toBe("You have used this month's 2 runs. They reset on 2026-11-01.");
  });

  it('lets a person cap override the server default', async () => {
    const caps = new RunCapsService(
      database.db,
      new ConfigService({ RUN_CAP_PER_USER_MONTH: 2 }) as never,
    );
    await database.db.update(users).set({ runCap: 50 });
    expect((await caps.allowance(userId, new Date('2026-10-15T00:00:00Z'))).cap).toBe(50);
  });
});
