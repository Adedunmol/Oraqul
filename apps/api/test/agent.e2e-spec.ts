import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { threadEventSchema } from '@oraqul/schema';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AgentModule } from '../src/agent/agent.module.js';
import { envSchema } from '../src/config/env.js';

describe('agent threads (e2e, demo data)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
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
        AgentModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists a demo project for every category', async () => {
    const res = await request(app.getHttpServer()).get('/demo/projects').expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual([
      'film',
      'music',
      'books',
      'podcasts',
      'games',
    ]);
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
