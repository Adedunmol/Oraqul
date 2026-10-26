import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB } from '../src/db/db.module.js';
import { GuideController } from '../src/guide/guide.controller.js';
import { GuideService } from '../src/guide/guide.service.js';
import { GUIDE_BOT } from '../src/guide/guide-bot.js';
import { GuideLimiterService } from '../src/guide/guide-limiter.service.js';
import { createTestDatabase } from './test-database.js';

describe('POST /guide/ask (e2e)', () => {
  let app: INestApplication<App>;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
    const config = new ConfigService({
      SESSION_SECRET: 'x'.repeat(32),
      GUIDE_BOT_HOURLY_LIMIT: 5,
      GUIDE_BOT_DAILY_CAP: 50,
    });
    const bot = { ask: async () => ({ answer: 'Name the cities, home first.', sources: [] }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [GuideController],
      providers: [
        GuideService,
        GuideLimiterService,
        { provide: DB, useValue: database.db },
        { provide: ConfigService, useValue: config },
        { provide: GUIDE_BOT, useValue: bot },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('answers a visitor with no session', async () => {
    await request(app.getHttpServer())
      .post('/guide/ask')
      .send({ question: 'How do I list cities?' })
      .expect(200)
      .expect({ answer: 'Name the cities, home first.', sources: [] });
  });

  it('rejects a question that is empty or too long', async () => {
    await request(app.getHttpServer()).post('/guide/ask').send({ question: ' ' }).expect(400);
    await request(app.getHttpServer())
      .post('/guide/ask')
      .send({ question: 'x'.repeat(401) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/guide/ask')
      .send({ question: 'Hi there', history: new Array(7).fill({ role: 'user', text: 'a' }) })
      .expect(400);
  });
});
