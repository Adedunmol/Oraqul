import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB } from '../src/db/db.module.js';
import { HealthModule } from '../src/health/health.module.js';

describe('GET /health (e2e)', () => {
  let app: INestApplication<App>;

  async function createApp(execute: () => Promise<unknown>) {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
      .useMocker((token) => (token === DB ? { execute } : undefined))
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    await app.close();
  });

  it('reports ok when the database answers', async () => {
    await createApp(async () => []);
    await request(app.getHttpServer()).get('/health').expect(200).expect({ ok: true, db: true });
  });

  it('reports not ok when the database fails', async () => {
    await createApp(async () => {
      throw new Error('down');
    });
    await request(app.getHttpServer()).get('/health').expect(200).expect({ ok: false, db: false });
  });
});
