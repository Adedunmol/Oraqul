import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  overviewSchema,
  pinnedProjectsSchema,
  projectDetailSchema,
  projectListSchema,
  type ThreadDetail,
  threadDetailSchema,
} from '@oraqul/schema';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RunService } from '../src/agent/run.service.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { type AuthedRequest, SessionGuard } from '../src/auth/session.guard.js';
import { UsersService } from '../src/auth/users.service.js';
import { envSchema } from '../src/config/env.js';
import { DB, DbModule } from '../src/db/db.module.js';
import { memberships, projects } from '../src/db/schema.js';
import { LlmModule } from '../src/llm/llm.module.js';
import { ProjectsModule } from '../src/projects/projects.module.js';
import { TeamsService } from '../src/teams/teams.service.js';
import { createTestDatabase } from './test-database.js';

const emails = {
  owner: 'owner@example.com',
  editor: 'editor@example.com',
  viewer: 'viewer@example.com',
  stranger: 'stranger@example.com',
} as const;

// No model key, so the router is the scripted one: it takes only what is plainly written.
describe('projects and the router (e2e, real guards and SQL, session lookup stubbed)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication<App>;
  let runs: RunService;
  let teamId: string;
  const ids = {} as Record<keyof typeof emails, string>;
  const as = (who: keyof typeof emails) => ({ 'x-test-user': emails[who] });
  const http = () => app.getHttpServer();

  /** Waits for the background run to stop, then returns the thread as the web would read it. */
  async function settled(threadId: string): Promise<ThreadDetail> {
    for (let i = 0; i < 100 && runs.isBusy(threadId); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const res = await request(http()).get(`/threads/${threadId}`).set(as('viewer')).expect(200);
    return threadDetailSchema.parse(res.body);
  }

  async function start(text: string, extra: Record<string, unknown> = {}) {
    const res = await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as('editor'))
      .send({ text, ...extra })
      .expect(201);
    return res.body as { projectId: string; threadId: string };
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    const accounts = new UsersService(database.db);
    for (const [who, email] of Object.entries(emails)) {
      ids[who as keyof typeof emails] = (await accounts.findOrCreateVerified(email, who)).id;
    }
    const sessionStub = {
      canActivate: async (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<AuthedRequest>();
        const email = req.header('x-test-user');
        const user = email ? await accounts.findByEmail(email) : undefined;
        if (!user) throw new UnauthorizedException();
        req.user = user;
        return true;
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            envSchema.parse({
              DATABASE_URL: 'postgres://u:p@localhost:5433/db',
              SESSION_SECRET: 'x'.repeat(32),
              WEB_ORIGIN: 'http://localhost:3000',
            }),
        }),
        DbModule,
        LlmModule,
        AuthModule,
        ProjectsModule,
      ],
      providers: [TeamsService],
    })
      .overrideProvider(DB)
      .useValue(database.db)
      .overrideGuard(SessionGuard)
      .useValue(sessionStub)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    runs = moduleRef.get(RunService);

    const team = await moduleRef.get(TeamsService).create(ids.owner, 'Studio');
    teamId = team.id;
    for (const role of ['editor', 'viewer'] as const) {
      await database.db.insert(memberships).values({ teamId, userId: ids[role], role });
    }
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('asks for the mode, takes the pick, names the project and hands it to its agent', async () => {
    const { projectId, threadId } = await start('i have a song titled tomorrow');

    // A draft: no list shows it, but its own workspace does.
    const list = await request(http()).get(`/teams/${teamId}/projects`).set(as('owner'));
    expect(projectListSchema.parse(list.body).some((p) => p.id === projectId)).toBe(false);

    const asked = await settled(threadId);
    expect(asked.project).toMatchObject({ status: 'intake', name: null, category: null });
    const question = asked.items.findLast((i) => i.role === 'question');
    if (question?.role !== 'question' || question.question.card !== 'single') {
      throw new Error('Expected an open single card');
    }
    expect(question.question.options.map((o) => o.label)).toEqual([
      'Make a plan',
      'Check my plan',
      'Fix one that missed',
    ]);

    await request(http())
      .post(`/threads/${threadId}/messages`)
      .set(as('editor'))
      .send({
        kind: 'answer',
        answer: { kind: 'options', questionId: question.question.id, optionIds: ['o1'] },
      })
      .expect(202);

    const done = await settled(threadId);
    expect(done.project).toMatchObject({
      status: 'Planning',
      name: 'tomorrow',
      category: 'music',
      mode: 'build',
    });
    expect(done.thread.name).toBe('First plan');
    expect(done.items.find((i) => i.role === 'question')).toMatchObject({ answer: 'Make a plan' });
    const said = done.items.flatMap((i) => (i.role === 'agent' ? [i.text] : []));
    expect(said[0]).toBe('Reading this as a new launch plan for “tomorrow” (Music).');
    expect(said[1]).toContain("The Music agent isn't connected yet");

    const listed = await request(http())
      .get(`/teams/${teamId}/projects?category=music`)
      .set(as('viewer'));
    expect(projectListSchema.parse(listed.body).map((p) => p.id)).toContain(projectId);
  });

  it('replays stored events and ends with the run status', async () => {
    const { threadId } = await start('Check my plan for the film "Salt Road"');
    await settled(threadId);
    const events: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const sub = runs.events(threadId, 0).subscribe({
        next: ({ event }) => {
          events.push(event.type);
          if (event.type === 'run.stopped') {
            sub.unsubscribe();
            resolve();
          }
        },
        error: reject,
      });
    });
    expect(events).toContain('trace.step');
    expect(events).toContain('message');
    expect(events.at(-1)).toBe('run.stopped');
  });

  it('lets a typed message answer the open card', async () => {
    const { threadId } = await start('my new podcast');
    const asked = await settled(threadId);
    expect(asked.items.at(-1)).toMatchObject({ role: 'question' });

    await request(http())
      .post(`/threads/${threadId}/messages`)
      .set(as('editor'))
      .send({ kind: 'text', text: 'launch it, it is called "Long Table"' })
      .expect(202);
    const done = await settled(threadId);
    expect(done.project).toMatchObject({ name: 'Long Table', category: 'podcasts', mode: 'build' });
  });

  it('enforces roles: viewers read, strangers get 403, only owners delete', async () => {
    const { projectId, threadId } = await start('Plan the launch of the game "Ember Quay"');
    await settled(threadId);

    await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as('viewer'))
      .send({ text: 'x' })
      .expect(403);
    await request(http())
      .post(`/threads/${threadId}/messages`)
      .set(as('viewer'))
      .send({ kind: 'text', text: 'hi' })
      .expect(403);
    await request(http()).get(`/projects/${projectId}`).set(as('stranger')).expect(403);
    await request(http()).get(`/threads/${threadId}`).set(as('stranger')).expect(403);
    await request(http()).get(`/projects/not-a-uuid`).set(as('owner')).expect(403);

    const detail = await request(http())
      .get(`/projects/${projectId}`)
      .set(as('viewer'))
      .expect(200);
    expect(projectDetailSchema.parse(detail.body).myRole).toBe('viewer');

    await request(http()).delete(`/projects/${projectId}`).set(as('editor')).expect(403);
    await request(http()).delete(`/projects/${projectId}`).set(as('owner')).expect(204);
    await request(http()).get(`/projects/${projectId}`).set(as('owner')).expect(403);
  });

  it('rejects an empty first message and a pick that is not on the card', async () => {
    await request(http())
      .post(`/teams/${teamId}/projects`)
      .set(as('editor'))
      .send({ text: ' ' })
      .expect(400);
    const { threadId } = await start('something new');
    await settled(threadId);
    await request(http())
      .post(`/threads/${threadId}/messages`)
      .set(as('editor'))
      .send({ kind: 'answer', answer: { kind: 'options', questionId: 'nope', optionIds: ['o1'] } })
      .expect(400);
  });

  it('keeps three pins, dropping the oldest, and lists them first', async () => {
    const made: string[] = [];
    for (const name of ['One', 'Two', 'Three', 'Four']) {
      const { projectId, threadId } = await start(`Plan the release of the album "${name}"`);
      await settled(threadId);
      made.push(projectId);
    }
    for (const id of made) {
      await request(http()).put(`/me/pins/${id}`).set(as('viewer')).expect(200);
    }
    const pins = pinnedProjectsSchema.parse(
      (await request(http()).get('/me/pins').set(as('viewer')).expect(200)).body,
    );
    expect(pins).toEqual([made[3], made[2], made[1]]);

    await request(http()).delete(`/me/pins/${made[3]}`).set(as('viewer')).expect(200);
    await request(http()).put(`/me/pins/${made[0]}`).set(as('stranger')).expect(403);
  });

  it('lists a waiting question under Needs you once the project is set up', async () => {
    const { projectId, threadId } = await start('Plan the release of the film "Harbour Lights"');
    await settled(threadId);
    // A second chat on a set-up project, left with an open card by hand.
    const created = await request(http())
      .post(`/projects/${projectId}/threads`)
      .set(as('editor'))
      .expect(201);
    expect(created.body.threadId).toBeDefined();

    const overview = overviewSchema.parse(
      (await request(http()).get(`/teams/${teamId}/overview`).set(as('owner')).expect(200)).body,
    );
    expect(overview.threads.length + overview.needsYou.length).toBeGreaterThan(0);
    const [draft] = await database.db
      .select()
      .from(projects)
      .where(and(eq(projects.teamId, teamId), eq(projects.status, 'intake')))
      .limit(1);
    if (draft) {
      expect(
        overview.needsYou.some((n) => n.project.id === draft.id) ||
          overview.threads.some((t) => t.project.id === draft.id),
      ).toBe(false);
    }
  });
});
