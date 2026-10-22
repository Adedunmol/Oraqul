import { and, eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import type { NewOutput } from '../agent/category-agents.js';
import { OutputStore } from '../agent/output-store.js';
import { outcomes, projects, reactions, runs, teams, threads, users } from '../db/schema.js';
import { ReactionsService } from './reactions.service.js';

describe('reactions and outcomes', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let service: ReactionsService;
  let store: OutputStore;
  let ada: string;
  let bob: string;
  let projectId: string;
  let threadId: string;
  let runId: string;

  const mine = async (outputId: string, userId: string) => {
    const [row] = await database.db
      .select({ kind: reactions.kind })
      .from(reactions)
      .where(and(eq(reactions.outputId, outputId), eq(reactions.userId, userId)));
    return { kind: row?.kind ?? null };
  };

  const saveOutput = async (over: Partial<NewOutput>) => {
    const base = {
      kind: 'build',
      title: 'Plan',
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

  beforeAll(async () => {
    database = await createTestDatabase();
    service = new ReactionsService(database.db);
    store = new OutputStore(database.db);
    const [a, b] = await database.db
      .insert(users)
      .values([
        { email: 'ada@example.com', name: 'Ada' },
        { email: 'bob@example.com', name: 'Bob' },
      ])
      .returning();
    ada = a?.id ?? '';
    bob = b?.id ?? '';
    const [team] = await database.db.insert(teams).values({ name: 'T' }).returning();
    const [project] = await database.db
      .insert(projects)
      .values({ teamId: team?.id ?? '', category: 'film', status: 'active' })
      .returning();
    projectId = project?.id ?? '';
    const [thread] = await database.db
      .insert(threads)
      .values({ projectId, name: 'Chat', createdBy: ada })
      .returning();
    threadId = thread?.id ?? '';
    const [run] = await database.db.insert(runs).values({ threadId, agent: 'film' }).returning();
    runId = run?.id ?? '';
  }, 60_000);
  afterAll(() => database.close());

  it('keeps one reaction per person, replaces it, and takes it back', async () => {
    const id = await saveOutput({});
    expect(await mine(id, ada)).toEqual({ kind: null });
    expect(await service.set(id, ada, 'useful')).toEqual({ kind: 'useful' });
    expect(await service.set(id, ada, 'wrong')).toEqual({ kind: 'wrong' });
    expect(await service.set(id, bob, 'useful')).toEqual({ kind: 'useful' });
    expect(await mine(id, ada)).toEqual({ kind: 'wrong' });
    const rows = await database.db.select().from(reactions).where(eq(reactions.outputId, id));
    expect(rows).toHaveLength(2);
    expect(await service.set(id, ada, null)).toEqual({ kind: null });
    expect(await mine(id, ada)).toEqual({ kind: null });
    expect(await mine(id, bob)).toEqual({ kind: 'useful' });
  });

  it('stores the findings the plan cited when it was rated', async () => {
    const id = await saveOutput({
      plan: { findings: [{ id: 'f-markets' }, { id: 'f-audience' }] } as never,
    });
    await service.set(id, ada, 'wrong');
    const [row] = await database.db.select().from(reactions).where(eq(reactions.outputId, id));
    expect(row?.findingIds).toEqual(['f-markets', 'f-audience']);
  });

  it('refuses a reaction to an output that does not exist', async () => {
    await expect(
      service.set('00000000-0000-4000-8000-000000000000', ada, 'useful'),
    ).rejects.toThrow('No such output');
  });

  it('records what a plan predicted next to what happened when an audit compares results', async () => {
    const id = await saveOutput({
      kind: 'audit',
      report: {
        results: {
          asOf: '2026-10-01',
          measure: 'tickets sold',
          rows: [
            {
              place: 'Lagos',
              actualShare: 60,
              plannedRank: 2,
              actualRank: 1,
              lift: 1.4,
              gap: 'over',
            },
            {
              place: 'London',
              actualShare: 40,
              plannedRank: 1,
              actualRank: 2,
              lift: 1.1,
              gap: 'under',
            },
          ],
          ages: [{ band: '25_to_29', actualShare: 55, index: 72 }],
          brokeItemId: null,
        },
      } as never,
    });
    const rows = await database.db.select().from(outcomes).where(eq(outcomes.outputId, id));
    expect(
      rows.map((r) => [r.kind, r.label, r.plannedRank, r.actualRank, r.predicted, r.gap]),
    ).toEqual(
      expect.arrayContaining([
        ['place', 'Lagos', 2, 1, 1.4, 'over'],
        ['place', 'London', 1, 2, 1.1, 'under'],
        ['age', '25_to_29', null, null, 72, null],
      ]),
    );
    expect(rows.every((r) => r.category === 'film' && r.measure === 'tickets sold')).toBe(true);
  });

  it('records nothing for a plan with no results', async () => {
    const id = await saveOutput({});
    expect(await database.db.select().from(outcomes).where(eq(outcomes.outputId, id))).toEqual([]);
    const audit = await saveOutput({
      kind: 'audit',
      report: {
        results: { asOf: null, measure: 'streams', rows: [], ages: null, brokeItemId: null },
      } as never,
    });
    expect(await database.db.select().from(outcomes).where(eq(outcomes.outputId, audit))).toEqual(
      [],
    );
  });
});
