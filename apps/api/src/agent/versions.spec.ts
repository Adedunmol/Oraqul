import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import { outputs, projects, runs, teams, threads, users } from '../db/schema.js';
import type { NewOutput } from './category-agents.js';
import { OutputStore } from './output-store.js';
import { promptVersion, versionsOf } from './versions.js';

describe('versionsOf', () => {
  it('names the host in live mode and "demo" otherwise', () => {
    const base = {
      writerModel: 'gpt-x',
      codeVersion: 'abc123',
      qlooBaseUrl: 'https://api.qloo.com/v2',
    };
    expect(versionsOf({ ...base, qlooMode: 'live' })).toEqual({
      writerModel: 'gpt-x',
      qlooHost: 'api.qloo.com',
      promptVersion,
      codeVersion: 'abc123',
    });
    expect(versionsOf({ ...base, qlooMode: 'demo' }).qlooHost).toBe('demo');
  });

  it('says dev for an unset code version and null for the template writer', () => {
    const v = versionsOf({ writerModel: '', codeVersion: '', qlooBaseUrl: '', qlooMode: 'demo' });
    expect(v).toMatchObject({ writerModel: null, codeVersion: 'dev' });
  });

  it('is a short hash that is the same on every call', () => {
    expect(promptVersion).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('OutputStore versions', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(() => database.close());

  it('saves the versions on each plan it stores', async () => {
    const [user] = await database.db
      .insert(users)
      .values({ email: 'a@example.com', name: 'A' })
      .returning();
    const [team] = await database.db.insert(teams).values({ name: 'T' }).returning();
    const [project] = await database.db
      .insert(projects)
      .values({ teamId: team?.id ?? '', category: 'film', status: 'active' })
      .returning();
    const [thread] = await database.db
      .insert(threads)
      .values({ projectId: project?.id ?? '', name: 'Chat', createdBy: user?.id ?? '' })
      .returning();
    const [run] = await database.db
      .insert(runs)
      .values({ threadId: thread?.id ?? '', agent: 'film' })
      .returning();
    const stamp = versionsOf({
      writerModel: 'gpt-x',
      codeVersion: 'abc123',
      qlooBaseUrl: 'https://api.qloo.com',
      qlooMode: 'live',
    });
    const store = new OutputStore(database.db, stamp);
    const output = {
      kind: 'plan',
      title: 'Plan',
      brief: {},
      plan: null,
      report: null,
      headline: 'Open in Lagos',
      moves: [],
      confidence: { level: 'medium', why: 'test' },
      inputs: null,
    } as unknown as NewOutput;
    const [id] = await store.save({
      threadId: thread?.id ?? '',
      projectId: project?.id ?? '',
      runId: run?.id ?? '',
      outputs: [output],
      receipts: [],
    });
    const [row] = await database.db
      .select()
      .from(outputs)
      .where(eq(outputs.id, id ?? ''));
    expect(row?.versions).toEqual(stamp);
  });
});
