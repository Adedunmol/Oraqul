import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { threadEventSchema } from '@oraqul/schema';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AgentModule } from '../src/agent/agent.module.js';
import { SessionGuard } from '../src/auth/session.guard.js';
import { envSchema } from '../src/config/env.js';
import { DB, DbModule } from '../src/db/db.module.js';

const config = ConfigModule.forRoot({
  isGlobal: true,
  ignoreEnvFile: true,
  validate: () =>
    envSchema.parse({
      DATABASE_URL: 'postgres://u:p@localhost:5433/db',
      SESSION_SECRET: 'x'.repeat(32),
      WEB_ORIGIN: 'http://localhost:3000',
    }),
});

describe('agent routes without a session (e2e)', () => {
  it('answers 401 and has no demo access', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [config, DbModule, AgentModule] })
      .overrideProvider(DB)
      .useValue({})
      .compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
    const http = app.getHttpServer();
    await request(http).post('/projects/film/threads').send({}).expect(401);
    await request(http).get('/threads/anything').expect(401);
    await request(http).get('/demo/projects').expect(404);
    await app.close();
  });
});

describe('agent threads (e2e, scripted planner and stand-in Qloo data)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [config, DbModule, AgentModule] })
      .overrideProvider(DB)
      .useValue({})
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('runs a film thread from the start card to an answer with receipts', async () => {
    const http = app.getHttpServer();
    const created = await request(http)
      .post('/projects/film/threads')
      .send({ mode: 'start' })
      .expect(201);
    const id: string = created.body.threadId;

    await request(http)
      .post(`/threads/${id}/messages`)
      .send({ kind: 'options', questionId: 'router.confirm', optionIds: ['start'] })
      .expect(201);
    const done = await request(http)
      .post(`/threads/${id}/messages`)
      .send({ kind: 'options', questionId: 'entity.match', optionIds: ['DEMO-FILM-0001'] })
      .expect(201);

    expect(done.body.status).toBe('done');
    const events = done.body.events.map((e: unknown) => threadEventSchema.parse(e));
    expect(events.at(-1)).toEqual({ type: 'run.stopped', reason: 'finished' });
    expect(events.some((e: { type: string }) => e.type === 'receipt')).toBe(true);
  });

  it('rejects a bad answer body and an answer to a finished thread', async () => {
    const http = app.getHttpServer();
    const created = await request(http).post('/projects/music/threads').send({}).expect(201);
    const id: string = created.body.threadId;

    await request(http).post(`/threads/${id}/messages`).send({ kind: 'options' }).expect(400);
    await request(http)
      .post(`/threads/${id}/messages`)
      .send({ kind: 'options', questionId: 'router.confirm', optionIds: ['start'] })
      .expect(201);
    await request(http)
      .post(`/threads/${id}/messages`)
      .send({ kind: 'options', questionId: 'router.confirm', optionIds: ['start'] })
      .expect(400);
  });

  it('404s for an unknown thread and a non-category project id', async () => {
    const http = app.getHttpServer();
    await request(http).get('/threads/nope').expect(404);
    await request(http).post('/projects/nope/threads').send({}).expect(400);
  });
});
