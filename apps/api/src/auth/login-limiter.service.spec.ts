import { createTestDatabase } from '../../test/test-database.js';
import { loginFailures } from '../db/schema.js';
import { LoginLimiterService } from './login-limiter.service.js';

describe('LoginLimiterService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let limiter: LoginLimiterService;

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(() => database.close());

  beforeEach(async () => {
    await database.db.delete(loginFailures);
    limiter = new LoginLimiterService(database.db);
  });

  async function fail(email: string, ip: string, times: number) {
    for (let i = 0; i < times; i++) {
      await limiter.recordFailure(email, ip);
    }
  }

  it('allows a few wrong passwords, then answers 429 for that account and address', async () => {
    await fail('ada@example.com', '1.1.1.1', 4);
    await expect(limiter.assertAllowed('ada@example.com', '1.1.1.1')).resolves.toBeUndefined();
    await fail('ada@example.com', '1.1.1.1', 1);
    await expect(limiter.assertAllowed('ada@example.com', '1.1.1.1')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('does not lock the owner out when someone else guesses from another address', async () => {
    await fail('ada@example.com', '9.9.9.9', 10);
    await expect(limiter.assertAllowed('ada@example.com', '1.1.1.1')).resolves.toBeUndefined();
  });

  it('blocks an address that tries many accounts', async () => {
    for (let i = 0; i < 20; i++) {
      await limiter.recordFailure(`user${i}@example.com`, '2.2.2.2');
    }
    await expect(limiter.assertAllowed('fresh@example.com', '2.2.2.2')).rejects.toMatchObject({
      status: 429,
    });
    await expect(limiter.assertAllowed('fresh@example.com', '3.3.3.3')).resolves.toBeUndefined();
  });

  it('forgets failures after a successful sign in', async () => {
    await fail('ada@example.com', '1.1.1.1', 5);
    await limiter.clear('ada@example.com', '1.1.1.1');
    await expect(limiter.assertAllowed('ada@example.com', '1.1.1.1')).resolves.toBeUndefined();
  });

  it('ignores failures older than the window and prunes them', async () => {
    await fail('ada@example.com', '1.1.1.1', 5);
    await database.db.update(loginFailures).set({ createdAt: new Date(Date.now() - 16 * 60_000) });
    await expect(limiter.assertAllowed('ada@example.com', '1.1.1.1')).resolves.toBeUndefined();
    await limiter.recordFailure('ada@example.com', '1.1.1.1');
    expect(await database.db.select().from(loginFailures)).toHaveLength(1);
  });
});
