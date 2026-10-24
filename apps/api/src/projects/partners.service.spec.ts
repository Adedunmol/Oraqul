import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import type { NewOutput } from '../agent/category-agents.js';
import { OutputStore } from '../agent/output-store.js';
import { outputs, projects, runs, teams, threads, users } from '../db/schema.js';
import { PartnersService } from './partners.service.js';
import type { ProjectsService } from './projects.service.js';

const plan = {
  scope: 'full',
  sections: [],
  comps: [],
  findings: [
    {
      id: 'f-brands-lagos',
      query: 'brands',
      text: '',
      entities: ['Bolt', 'Verve', 'Ride Co'].map((name) => ({
        entityId: null,
        name,
        affinity: 0.5,
        detail: null,
        popularity: 0.5,
      })),
      numbers: {},
      verdict: null,
      confidence: 'medium',
      why: '',
      context: { city: 'Lagos', ages: [], tags: [], country: null, yearFrom: null, audience: null },
      callIds: [],
    },
  ],
  sources: [],
  dropped: [],
  writer: 'template',
  understanding: null,
  review: null,
  process: null,
  rules: null,
  band: { band: 'mid', source: 'brief' },
  signal: null,
  territories: [],
  calls: [],
  partners: [],
  partnerNotes: [],
};

describe('the team’s partners on a saved plan', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let outputId: string;
  let service: PartnersService;
  let kind: NewOutput['kind'] = 'build';

  beforeAll(async () => {
    database = await createTestDatabase();
    const store = new OutputStore(database.db);
    const [user] = await database.db
      .insert(users)
      .values({ email: 'ada@example.com', name: 'Ada' })
      .returning();
    const [team] = await database.db.insert(teams).values({ name: 'T' }).returning();
    const [project] = await database.db
      .insert(projects)
      .values({ teamId: team?.id ?? '', category: 'film', status: 'active' })
      .returning();
    const projectId = project?.id ?? '';
    const [thread] = await database.db
      .insert(threads)
      .values({ projectId, name: 'Chat', createdBy: user?.id ?? '' })
      .returning();
    const threadId = thread?.id ?? '';
    const [run] = await database.db.insert(runs).values({ threadId, agent: 'film' }).returning();
    const [id] = await store.save({
      threadId,
      projectId,
      runId: run?.id ?? '',
      outputs: [
        {
          kind: 'build',
          title: 'Plan',
          brief: {},
          plan,
          report: null,
          headline: 'Open in Lagos',
          moves: [],
          confidence: { level: 'medium', why: 'test' },
          inputs: null,
        } as unknown as NewOutput,
      ],
      receipts: [],
    });
    outputId = id ?? '';
    // Only the plan and the project's category are read; the rest of the detail is not needed.
    const projects_ = {
      outputDetail: async () => {
        const [row] = await database.db.select().from(outputs).where(eq(outputs.id, outputId));
        return { output: { kind, plan: row?.plan }, project: { category: 'film' } };
      },
    } as unknown as ProjectsService;
    service = new PartnersService(database.db, projects_);
  }, 60_000);
  afterAll(() => database.close());

  it('saves the team’s partners on the plan and takes them off again', async () => {
    const added = await service.set(outputId, ['Verve', 'Corner Cafe']);
    expect(added.partners.filter((p) => p.from === 'team').map((p) => p.name)).toEqual([
      'Verve',
      'Corner Cafe',
    ]);
    const [saved] = await database.db.select().from(outputs).where(eq(outputs.id, outputId));
    expect(JSON.stringify(saved?.plan)).toContain('Corner Cafe');
    const removed = await service.set(outputId, ['Verve']);
    expect(removed.partners.some((p) => p.name === 'Corner Cafe')).toBe(false);
    expect(removed.partners.find((p) => p.name === 'Verve')?.fit).toMatchObject({
      place: 2,
      of: 3,
    });
  });

  it('refuses a kit, which has no partners to edit', async () => {
    kind = 'creative';
    await expect(service.set(outputId, ['Verve'])).rejects.toThrow('Only a full plan');
    kind = 'build';
  });
});
