import { launchPlanSchema } from '@oraqul/schema';
import { createTestDatabase } from '../../test/test-database.js';
import type { NewOutput } from '../agent/category-agents.js';
import { OutputStore } from '../agent/output-store.js';
import { projects, runs, teams, threads, users } from '../db/schema.js';

export const calendarRow = (id: string, at: number, from: string | null, asset: string | null) => ({
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
  grade: 'directional' as const,
});

export const planWith = (
  calendar: ReturnType<typeof calendarRow>[],
  over: Record<string, unknown> = {},
) =>
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
      checkpoints: [-28, -7],
      target: { value: 1000, floor: null, unit: 'tickets', from: 'team', ruleId: null },
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
    ...over,
  });

/** One user, team, project, thread and run on an in-process Postgres, and a way to save outputs. */
export async function seedProject(category: 'film' = 'film') {
  const database = await createTestDatabase();
  const { db } = database;
  const store = new OutputStore(db);
  const [user] = await db
    .insert(users)
    .values({ email: 'ada@example.com', name: 'Ada' })
    .returning();
  const [team] = await db.insert(teams).values({ name: 'T' }).returning();
  const [project] = await db
    .insert(projects)
    .values({ teamId: team?.id ?? '', category, name: 'Night Ferry', status: 'active' })
    .returning();
  const projectId = project?.id ?? '';
  const [thread] = await db
    .insert(threads)
    .values({ projectId, name: 'Chat', createdBy: user?.id ?? '' })
    .returning();
  const threadId = thread?.id ?? '';
  const [run] = await db.insert(runs).values({ threadId, agent: category }).returning();
  const runId = run?.id ?? '';

  const save = async (over: Partial<NewOutput> & { createdAt?: Date }) => {
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

  return {
    database,
    db,
    store,
    save,
    userId: user?.id ?? '',
    teamId: team?.id ?? '',
    projectId,
    threadId,
    runId,
  };
}
