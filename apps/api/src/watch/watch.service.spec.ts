import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RunService } from '../agent/run.service.js';
import { watchEvents } from '../db/schema.js';
import { calendarRow, planWith, seedProject } from '../test-support/seed.js';
import { PaceService } from './pace.service.js';
import { WatchService } from './watch.service.js';

describe('WatchService and PaceService', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let outputId = '';
  const posted: { threadId: string; text: string; origin: unknown }[] = [];
  let service: WatchService;
  let pace: PaceService;
  const ctx = () => ({ userId: seed.userId, teamId: seed.teamId });

  beforeAll(async () => {
    seed = await seedProject();
    outputId = await seed.save({
      plan: planWith([calendarRow('launch', 0, '2099-03-12', 'daily post')]),
    });
    pace = new PaceService(seed.db);
    const runs = {
      post: async (threadId: string, body: { text: string }, origin: unknown) => {
        posted.push({ threadId, text: body.text, origin });
      },
    } as unknown as RunService;
    service = new WatchService(seed.db, pace, runs);
  });
  afterAll(() => seed.database.close());

  it('reports off until a watch is made, then on with its cadence', async () => {
    expect((await service.state(outputId, seed.userId)).status).toBe('off');
    const on = await service.update(outputId, ctx(), { cadence: 'weekly' });
    expect(on).toMatchObject({
      status: 'active',
      cadence: 'weekly',
      minSeverity: 'watch',
      watchable: true,
    });
  });

  it('refuses to watch an output that is not a launch plan', async () => {
    const answer = await seed.save({ kind: 'date', plan: null });
    await expect(service.update(answer, ctx(), {})).rejects.toThrow('Only a launch plan');
  });

  it('counts unread events, clears them when read, and keeps a mute per person', async () => {
    const [watch] = await seed.db.query.watches.findMany();
    const [event] = await seed.db
      .insert(watchEvents)
      .values({
        watchId: watch!.id,
        outputId,
        type: 'plan_stale',
        severity: 'act',
        dedupeKey: 'stale:x',
        detail: { title: 'Old', reason: 'It is old', evidence: [] },
      })
      .returning();
    expect((await service.state(outputId, seed.userId)).unread).toBe(1);
    expect((await service.unreadByProject([seed.projectId], seed.userId)).get(seed.projectId)).toBe(
      1,
    );
    await service.markRead(outputId, seed.userId);
    expect((await service.state(outputId, seed.userId)).unread).toBe(0);
    expect(
      (await service.unreadByProject([seed.projectId], seed.userId)).get(seed.projectId),
    ).toBeUndefined();
    expect((await service.mute(outputId, seed.userId, true)).muted).toBe(true);
    expect((await service.mute(outputId, seed.userId, false)).muted).toBe(false);

    // Approving starts the plan's own request on its chat as the person, via a watch.
    const after = await service.approve(outputId, event_(event), seed.userId);
    expect(posted).toEqual([
      {
        threadId: seed.threadId,
        text: 'Check what has changed since this plan was made.',
        origin: { userId: seed.userId, via: 'watch' },
      },
    ]);
    expect(after.events[0]?.status).toBe('approved');
    await expect(service.approve(outputId, event_(event), seed.userId)).rejects.toThrow(
      'already answered',
    );
  });

  it('only runs for events that have a run to start, and a dismissed event stays dismissed', async () => {
    const [watch] = await seed.db.query.watches.findMany();
    const [event] = await seed.db
      .insert(watchEvents)
      .values({
        watchId: watch!.id,
        outputId,
        type: 'rival_date',
        severity: 'watch',
        dedupeKey: 'rival:x',
        detail: { title: 'Rival', reason: 'Opens', evidence: [] },
      })
      .returning();
    await expect(service.approve(outputId, event_(event), seed.userId)).rejects.toThrow(
      'nothing to run',
    );
    expect(posted).toHaveLength(1);
    const state = await service.dismiss(outputId, event_(event), seed.userId);
    expect(state.events.find((e) => e.id === event?.id)?.status).toBe('dismissed');
  });

  it('keeps pace figures: a repeated day replaces the value, and a target and curve can be edited', async () => {
    await pace.save(outputId, seed.userId, [
      { onDate: '2099-02-26', value: 10, city: '', channel: '' },
      { onDate: '2099-02-27', value: 20, city: 'Lagos', channel: '' },
    ]);
    await pace.save(outputId, seed.userId, [
      { onDate: '2099-02-26', value: 15, city: '', channel: '' },
    ]);
    const state = await pace.state(outputId, '2099-03-01');
    expect(state.entries.map((e) => e.value)).toEqual([15, 20]);
    expect(state.releaseDate).toBe('2099-03-12');
    expect(state.settings).toMatchObject({ target: 1000, curveFrom: 'rule', kind: 'cumulative' });

    const edited = await pace.update(outputId, {
      target: 2000,
      curve: [
        { day: -30, share: 0 },
        { day: 0, share: 1 },
      ],
    });
    expect(edited.settings).toMatchObject({ target: 2000, curveFrom: 'team' });
    const reset = await pace.update(outputId, { resetCurve: true });
    expect(reset.settings).toMatchObject({ target: 2000, curveFrom: 'rule' });
    await pace.remove(outputId, state.entries[0]!.id);
    expect((await pace.state(outputId)).entries).toHaveLength(1);
  });

  it('says there is nothing to pace when the plan has no release date', async () => {
    const undated = await seed.save({ plan: planWith([calendarRow('x', -2, null, 'post')]) });
    expect(await pace.state(undated)).toMatchObject({ available: false, result: null });
  });
});

function event_(e: { id: string } | undefined): string {
  return e?.id ?? '';
}
