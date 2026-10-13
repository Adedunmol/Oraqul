import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import { memberships, oauthAccounts, teams, users } from '../db/schema.js';
import { UsersService } from './users.service.js';

describe('UsersService linking by verified email', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let service: UsersService;

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(() => database.close());

  beforeEach(async () => {
    await database.db.delete(oauthAccounts);
    await database.db.delete(users);
    await database.db.delete(teams);
    service = new UsersService(database.db);
  });

  it('returns the same user for the same email', async () => {
    const first = await service.findOrCreateVerified('ada@example.com', 'Ada');
    const second = await service.findOrCreateVerified('ada@example.com', 'Someone else');
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Ada');
  });

  it('gives a new account a personal team it owns, once', async () => {
    const user = await service.findOrCreateVerified('ada@example.com', 'Ada');
    await service.findOrCreateVerified('ada@example.com', 'Ada');
    await service.findOrLinkOAuth('google', 'sub-1', 'ada@example.com', 'Ada');

    const rows = await database.db
      .select({ name: teams.name, role: memberships.role, userId: memberships.userId })
      .from(memberships)
      .innerJoin(teams, eq(teams.id, memberships.teamId));
    expect(rows).toEqual([{ name: "Ada's team", role: 'owner', userId: user.id }]);
  });

  it('gives a team to a new account made through Google', async () => {
    const user = await service.findOrLinkOAuth('google', 'sub-2', 'bob@example.com', 'Bob');
    const rows = await database.db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));
    expect(rows).toHaveLength(1);
  });

  it('links a Google sign in to the account that already has that email', async () => {
    const existing = await service.findOrCreateVerified('ada@example.com', 'Ada');
    const viaGoogle = await service.findOrLinkOAuth('google', 'sub-1', 'ada@example.com', 'Ada L');
    expect(viaGoogle.id).toBe(existing.id);
    const again = await service.findOrLinkOAuth('google', 'sub-1', 'ada@example.com', 'Ada L');
    expect(again.id).toBe(existing.id);
  });

  it('keeps following the Google account if its email later differs', async () => {
    const first = await service.findOrLinkOAuth('google', 'sub-1', 'ada@example.com', 'Ada');
    const later = await service.findOrLinkOAuth('google', 'sub-1', 'new@example.com', 'Ada');
    expect(later.id).toBe(first.id);
  });

  it('only sets a password on an account that has none', async () => {
    const user = await service.findOrCreateVerified('ada@example.com', 'Ada');
    await service.setPasswordIfMissing(user.id, 'first');
    await service.setPasswordIfMissing(user.id, 'second');
    expect((await service.findByEmail('ada@example.com'))?.passwordHash).toBe('first');
    await service.setPassword(user.id, 'reset');
    expect((await service.findByEmail('ada@example.com'))?.passwordHash).toBe('reset');
  });
});
