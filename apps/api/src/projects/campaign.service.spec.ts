import { launchPlanSchema } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import type { NewOutput } from '../agent/category-agents.js';
import { OutputStore } from '../agent/output-store.js';
import { campaignActions, projects, runs, teams, threads, users } from '../db/schema.js';
import { CampaignService } from './campaign.service.js';

const calendarRow = (id: string, at: number, from: string, asset: string | null) => ({
  id,
  territory: 'Lagos',
  key: id,
  at,
  from,
  to: from,
  asset,
  post: `Post ${id}.`,
  channel: 'Instagram',
  count: null,
  per: null,
  ruleId: 'film.calendar',
  grade: 'directional',
});

const planWith = (calendar: ReturnType<typeof calendarRow>[]) =>
  launchPlanSchema.parse({
    scope: 'full',
    sections: [],
    comps: [],
    findings: [],
    dropped: [],
    writer: 'template',
    signal: {
      key: 'tickets',
      primary: 'tickets sold',
      secondary: [],
      checkpoints: [],
      target: null,
    },
    territories: [
      {
        id: 't-lagos',
        name: 'Lagos',
        role: 'home',
        order: 1,
        callId: 'c',
        channels: [{ name: 'Instagram', lead: true }],
        partnerIds: [],
        lineIds: [],
      },
    ],
    calendar,
  });

describe('the campaign of a saved plan', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let service: CampaignService;
  let store: OutputStore;
  let projectId: string;
  let threadId: string;
  let runId: string;

  const save = async (over: Partial<NewOutput>) => {
    const base = {
      kind: 'build',
      title: 'Night Ferry',
      brief: {},
      plan: null,
      report: null,
      headline: 'Open in Lagos',
      moves: [],
      confidence: { level: 'medium', why: 'test' },
      inputs: null,
    };
    const [id] = await store.save({
      threadId,
      projectId,
      runId,
      outputs: [{ ...base, ...over } as unknown as NewOutput],
      receipts: [],
    });
    return id ?? '';
  };

  const rows = [
    calendarRow('teaser', -2, '2099-02-26', 'teaser, 10 to 30 seconds'),
    calendarRow('pitch', -1, '2099-03-05', 'press pitch'),
    calendarRow('launch', 0, '2099-03-12', 'daily post'),
  ];

  beforeAll(async () => {
    database = await createTestDatabase();
    service = new CampaignService(database.db);
    store = new OutputStore(database.db);
    const [user] = await database.db
      .insert(users)
      .values({ email: 'ada@example.com', name: 'Ada' })
      .returning();
    const [team] = await database.db.insert(teams).values({ name: 'T' }).returning();
    const [project] = await database.db
      .insert(projects)
      .values({ teamId: team?.id ?? '', category: 'film', status: 'active' })
      .returning();
    projectId = project?.id ?? '';
    const [thread] = await database.db
      .insert(threads)
      .values({ projectId, name: 'Chat', createdBy: user?.id ?? '' })
      .returning();
    threadId = thread?.id ?? '';
    const [run] = await database.db.insert(runs).values({ threadId, agent: 'film' }).returning();
    runId = run?.id ?? '';
  }, 60_000);
  afterAll(() => database.close());

  it('is ready to set up for a plan with a calendar, and sets up one action per row', async () => {
    const id = await save({ plan: planWith(rows) as never });
    expect((await service.state(id)).status).toBe('ready');
    const set = await service.setUp(id);
    expect(set.status).toBe('set');
    expect(set.actions.map((a) => a.rowId)).toEqual(['teaser', 'pitch', 'launch']);
    expect(set.actions.map((a) => a.status)).toEqual(['todo', 'todo', 'todo']);
    expect(set.actions[0]?.guide?.kind).toBe('hooks');
    expect(set.actions[1]?.guide).toBeNull();
  });

  it('does not make a second set when asked twice', async () => {
    const id = await save({ plan: planWith(rows) as never });
    await Promise.all([service.setUp(id), service.setUp(id)]);
    const stored = await database.db
      .select()
      .from(campaignActions)
      .where(eq(campaignActions.outputId, id));
    expect(stored).toHaveLength(3);
  });

  it('says why there is nothing to set up', async () => {
    const noCalendar = await save({ plan: planWith([]) as never });
    expect(await service.state(noCalendar)).toMatchObject({ status: 'none' });
    await expect(service.setUp(noCalendar)).rejects.toThrow('no content calendar');
    const audit = await save({ kind: 'audit', plan: null });
    expect(await service.state(audit)).toMatchObject({ status: 'none' });
    await expect(service.setUp(audit)).rejects.toThrow('not a launch plan');
  });

  it('marks an action done without calling it edited, and flags a rewrite as edited', async () => {
    const id = await save({ plan: planWith(rows) as never });
    const [first] = (await service.setUp(id)).actions;
    const done = await service.update(id, first?.id ?? '', { status: 'done' });
    expect(done).toMatchObject({ status: 'done', edited: false });
    const rewritten = await service.update(id, first?.id ?? '', {
      title: 'Post the teaser with the cast.',
      note: 'Ask Ada for the cut.',
    });
    expect(rewritten).toMatchObject({ edited: true, status: 'done' });
    expect(rewritten.note).toBe('Ask Ada for the cut.');
  });

  it('refuses to change an action through a different output', async () => {
    const a = await save({ plan: planWith(rows) as never });
    const b = await save({ plan: planWith(rows) as never });
    const [action] = (await service.setUp(a)).actions;
    await expect(service.update(b, action?.id ?? '', { status: 'done' })).rejects.toThrow(
      'No such action',
    );
  });

  it('gives a revised plan its own set and leaves the earlier set and its edits as they were', async () => {
    const v1 = await save({ plan: planWith(rows) as never });
    const [first] = (await service.setUp(v1)).actions;
    await service.update(v1, first?.id ?? '', { status: 'done', title: 'My own wording.' });

    const v2 = await save({ plan: planWith(rows.slice(0, 2)) as never });
    expect((await service.state(v2)).status).toBe('ready');
    const second = await service.setUp(v2);
    expect(second.actions).toHaveLength(2);
    expect(second.others.find((o) => o.outputId === v1)).toMatchObject({ actions: 3, done: 1 });

    const again = await service.state(v1);
    expect(again.actions).toHaveLength(3);
    expect(again.actions[0]).toMatchObject({
      status: 'done',
      title: 'My own wording.',
      edited: true,
    });
    expect(again.others.map((o) => o.outputId)).toContain(v2);
  });

  it('sets up one two-angle test for an action and takes it away again', async () => {
    const id = await save({ plan: planWith(rows) as never });
    const [action] = (await service.setUp(id)).actions;
    const test = await service.addTest(id, action?.id ?? '');
    expect(test.angles).toHaveLength(2);
    expect(test.measure).toContain('tickets sold');
    expect((await service.addTest(id, action?.id ?? '')).id).toBe(test.id);
    expect((await service.state(id)).tests).toHaveLength(1);
    await service.removeTest(id, action?.id ?? '');
    expect((await service.state(id)).tests).toHaveLength(0);
  });

  it('saves the team’s figures for a test and compares them in code', async () => {
    const id = await save({ plan: planWith(rows) as never });
    const [action] = (await service.setUp(id)).actions;
    await expect(
      service.setTestResults(id, action?.id ?? '', {
        measure: 'conversions',
        a: 120,
        b: 80,
        period: 'week one',
        source: 'the ad manager',
      }),
    ).rejects.toThrow('Set up the test');
    await service.addTest(id, action?.id ?? '');
    const test = await service.setTestResults(id, action?.id ?? '', {
      measure: 'conversions',
      a: 120,
      b: 80,
      period: 'week one',
      source: 'the ad manager',
    });
    expect(test.results).toMatchObject({ a: 120, b: 80, source: 'the ad manager' });
    expect(test.comparison?.verdict).toBe('a-ahead');
    const thin = await service.setTestResults(id, action?.id ?? '', {
      measure: 'conversions',
      a: 12,
      b: 8,
      period: null,
      source: null,
    });
    expect(thin.comparison?.verdict).toBe('inconclusive');
    expect((await service.state(id)).tests[0]?.comparison?.verdict).toBe('inconclusive');
  });
});
