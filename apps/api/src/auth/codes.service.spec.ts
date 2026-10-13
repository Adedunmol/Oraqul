import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import type { Env } from '../config/env.js';
import { emailCodes } from '../db/schema.js';
import { CodesService } from './codes.service.js';

const email = 'ada@example.com';

describe('CodesService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let codes: CodesService;

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(() => database.close());

  beforeEach(async () => {
    await database.db.delete(emailCodes);
    codes = new CodesService(
      database.db,
      new ConfigService<Env, true>({ SESSION_SECRET: 'x'.repeat(32) }),
    );
  });

  it('accepts the right code once', async () => {
    const code = await codes.issue(email, 'signin');
    expect(code).toMatch(/^\d{6}$/);
    await expect(codes.consume(email, ['signin'], code)).resolves.toMatchObject({ email });
    await expect(codes.consume(email, ['signin'], code)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a wrong code and counts the attempt', async () => {
    const code = await codes.issue(email, 'signin');
    const wrong = code === '000000' ? '111111' : '000000';
    await expect(codes.consume(email, ['signin'], wrong)).rejects.toMatchObject({ status: 400 });
    const [row] = await database.db.select().from(emailCodes);
    expect(row?.attempts).toBe(1);
  });

  it('locks after 5 wrong tries, even for the right code', async () => {
    const code = await codes.issue(email, 'signin');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(codes.consume(email, ['signin'], wrong)).rejects.toMatchObject({ status: 400 });
    }
    await expect(codes.consume(email, ['signin'], wrong)).rejects.toMatchObject({ status: 429 });
    await expect(codes.consume(email, ['signin'], code)).rejects.toMatchObject({ status: 429 });
  });

  it('rejects an expired code', async () => {
    const code = await codes.issue(email, 'signin');
    await database.db.update(emailCodes).set({ expiresAt: new Date(Date.now() - 1000) });
    await expect(codes.consume(email, ['signin'], code)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a code for another purpose', async () => {
    const code = await codes.issue(email, 'reset');
    await expect(codes.consume(email, ['signin', 'signup'], code)).rejects.toMatchObject({
      status: 400,
    });
    await expect(codes.consume(email, ['reset'], code)).resolves.toBeDefined();
  });

  it('rejects a code for another email', async () => {
    const code = await codes.issue(email, 'signin');
    await expect(codes.consume('bob@example.com', ['signin'], code)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('only the newest code works once a new one is issued', async () => {
    const first = await codes.issue(email, 'signin');
    const second = await codes.issue(email, 'signin');
    if (first !== second) {
      await expect(codes.consume(email, ['signin'], first)).rejects.toMatchObject({ status: 400 });
    }
    await expect(codes.consume(email, ['signin'], second)).resolves.toBeDefined();
  });

  it('limits how many codes one email can request', async () => {
    for (let i = 0; i < 5; i++) {
      await codes.issue(email, 'signin');
    }
    await expect(codes.issue(email, 'signin')).rejects.toMatchObject({ status: 429 });
    await expect(codes.issue(email, 'reset')).resolves.toBeDefined();
  });

  it('keeps a pending signup with the code and never stores the code itself', async () => {
    const code = await codes.issue(email, 'signup', { name: 'Ada', passwordHash: 'hash' });
    const [row] = await database.db.select().from(emailCodes).where(eq(emailCodes.email, email));
    expect(row?.codeHash).not.toContain(code);
    const used = await codes.consume(email, ['signin', 'signup'], code);
    expect(used).toMatchObject({ name: 'Ada', passwordHash: 'hash', purpose: 'signup' });
  });
});
