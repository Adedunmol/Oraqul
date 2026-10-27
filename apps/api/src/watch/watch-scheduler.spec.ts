import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EmailMessage } from '../auth/email/email-sender.js';
import { memberships, qlooUsage, users, watchEvents, watches, watchMutes } from '../db/schema.js';
import { calendarRow, planWith, seedProject } from '../test-support/seed.js';
import { PaceService } from './pace.service.js';
import type { RivalFinder } from './rival-dates.js';
import { WatchChecker } from './watch-checker.js';
import { LOCK_MS, WatchScheduler } from './watch-scheduler.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('WatchScheduler', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let outputId = '';
  const sent: EmailMessage[] = [];
  let finderCalls = 0;
  const finder: RivalFinder = {
    enabled: true,
    async find() {
      finderCalls++;
      return {
        tokens: 0,
        rivals: [
          {
            title: 'Salt Road 2',
            date: '2099-03-09',
            evidence: {
              url: 'https://listings.example/march',
              title: 'March listings',
              retrievedAt: '2026-10-27',
              quote: '9 March 2099',
            },
          },
        ],
      };
    },
  };
  const make = (checkerFinder: RivalFinder = finder) => {
    const checker = new WatchChecker(seed.db, checkerFinder, new PaceService(seed.db));
    return new WatchScheduler(
      seed.db,
      checker,
      {
        send: async (m) => {
          sent.push(m);
        },
      },
      new ConfigService({ WEB_ORIGIN: 'https://app.example', NODE_ENV: 'test' }) as never,
    );
  };
  const watchRow = async () => (await seed.db.select().from(watches))[0]!;

  beforeAll(async () => {
    seed = await seedProject();
    outputId = await seed.save({
      plan: planWith([calendarRow('launch', 0, '2099-03-12', 'daily post')]),
    });
    const [editor] = await seed.db
      .insert(users)
      .values({ email: 'ed@example.com', name: 'Ed' })
      .returning();
    await seed.db.insert(memberships).values([
      { teamId: seed.teamId, userId: seed.userId, role: 'owner' },
      { teamId: seed.teamId, userId: editor!.id, role: 'editor' },
    ]);
    await seed.db.insert(watchMutes).values({ userId: editor!.id, watchId: await newWatch() });
  });
  afterAll(() => seed.database.close());

  async function newWatch(): Promise<string> {
    const [w] = await seed.db
      .insert(watches)
      .values({
        outputId,
        projectId: seed.projectId,
        teamId: seed.teamId,
        nextCheckAt: new Date(Date.now() - 3 * DAY),
      })
      .returning();
    return w!.id;
  }

  it('runs a check missed during a restart once, writes events, and sends one digest to those who have not muted', async () => {
    const scheduler = make();
    const now = new Date();
    expect(await scheduler.tick(now)).toBe(1);

    const events = await seed.db.select().from(watchEvents);
    expect(events.map((e) => [e.type, e.severity])).toEqual([['rival_date', 'watch']]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.com');
    expect(sent[0]?.text).toContain('Salt Road 2 opens 2099-03-09');
    expect(sent[0]?.text).toContain('https://listings.example/march');
    expect(sent[0]?.text).toContain(`https://app.example/outputs/${outputId}?tab=watch`);
    expect(sent[0]?.text).not.toMatch(/qloo data|receipt|endpoint/i);

    const watch = await watchRow();
    expect(watch.lockedUntil).toBeNull();
    expect(watch.lastCheckedAt?.getTime()).toBe(now.getTime());
    expect(watch.nextCheckAt.getTime()).toBe(now.getTime() + DAY);
    expect(watch.lastNotes).toEqual(['The campaign is not set up, so no milestones were checked.']);
  });

  it('does nothing on the next tick, and the same rival a day later adds no event or email', async () => {
    const scheduler = make();
    const now = new Date();
    expect(await scheduler.tick(now)).toBe(0);
    expect(await scheduler.tick(new Date(now.getTime() + DAY + HOUR))).toBe(1);
    expect(await seed.db.select().from(watchEvents)).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('never runs one watch twice when ticks overlap, even from two scheduler instances', async () => {
    await seed.db.update(watches).set({ nextCheckAt: new Date(Date.now() - HOUR) });
    const before = finderCalls;
    const [a, b, c] = await Promise.all([make().tick(), make().tick(), make().tick()]);
    expect(a + b + c).toBe(1);
    expect(finderCalls - before).toBe(1);
  });

  it('picks a watch up again once its lock has lapsed, and not before', async () => {
    const now = new Date();
    await seed.db.update(watches).set({
      nextCheckAt: new Date(now.getTime() - HOUR),
      lockedUntil: new Date(now.getTime() + LOCK_MS),
    });
    expect(await make().tick(now)).toBe(0);
    expect(await make().tick(new Date(now.getTime() + LOCK_MS + 1000))).toBe(1);
  });

  it('skips a paused watch', async () => {
    await seed.db
      .update(watches)
      .set({ status: 'paused', nextCheckAt: new Date(Date.now() - DAY) });
    expect(await make().tick()).toBe(0);
    await seed.db.update(watches).set({ status: 'active' });
  });

  it('delays a check that fails by an hour instead of losing it, and frees the lock', async () => {
    const scheduler = make();
    const boom = new WatchChecker(seed.db, finder, new PaceService(seed.db));
    boom.run = async () => {
      throw new Error('database blip');
    };
    const broken = new WatchScheduler(
      seed.db,
      boom,
      { send: async () => undefined },
      new ConfigService({ WEB_ORIGIN: 'x', NODE_ENV: 'test' }) as never,
    );
    const now = new Date();
    await seed.db.update(watches).set({ nextCheckAt: new Date(now.getTime() - HOUR) });
    expect(await broken.tick(now)).toBe(1);
    const watch = await watchRow();
    expect(watch.lockedUntil).toBeNull();
    expect(watch.nextCheckAt.getTime()).toBe(now.getTime() + HOUR);
    expect(await scheduler.tick(new Date(now.getTime() + HOUR + 1000))).toBe(1);
  });

  it('says so when rival dates could not be checked, and never calls Qloo', async () => {
    const off = make({ enabled: false, find: async () => ({ rivals: [], tokens: 0 }) });
    await seed.db.update(watches).set({ nextCheckAt: new Date(Date.now() - HOUR) });
    await off.tick();
    expect((await watchRow()).lastNotes).toContain(
      'Rival dates were not checked: web search is not set up.',
    );
    expect(await seed.db.select().from(qlooUsage)).toEqual([]);
  });

  it('raises the plan-is-old event 14 days on, and again only the next week', async () => {
    const scheduler = make({ enabled: false, find: async () => ({ rivals: [], tokens: 0 }) });
    const later = new Date(Date.now() + 20 * DAY);
    await seed.db.update(watches).set({ nextCheckAt: new Date(later.getTime() - HOUR) });
    await scheduler.tick(later);
    const stale = await seed.db
      .select()
      .from(watchEvents)
      .where(eq(watchEvents.type, 'plan_stale'));
    expect(stale).toHaveLength(1);
    expect(stale[0]?.severity).toBe('act');
    const tomorrow = new Date(later.getTime() + DAY + HOUR);
    await scheduler.tick(tomorrow);
    const weeks = new Set(
      (await seed.db.select().from(watchEvents).where(eq(watchEvents.type, 'plan_stale'))).map(
        (e) => e.dedupeKey,
      ),
    );
    expect(weeks.size).toBeLessThanOrEqual(2);
  });
});
