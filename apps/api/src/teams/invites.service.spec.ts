import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import type { EmailMessage } from '../auth/email/email-sender.js';
import type { SessionUser } from '../auth/session.guard.js';
import { invites, memberships, teams, users } from '../db/schema.js';
import { INVITE_TTL_DAYS, InvitesService } from './invites.service.js';

describe('InvitesService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let service: InvitesService;
  let sent: EmailMessage[];
  let failSend: boolean;
  let owner: SessionUser;
  let teamId: string;
  let seq = 0;

  const token = (message: EmailMessage) => message.text.match(/\/invite\/([\w-]{43})/)?.[1] ?? '';

  beforeAll(async () => {
    database = await createTestDatabase();
    service = new InvitesService(
      database.db,
      {
        send: async (message) => {
          if (failSend) throw new Error('provider down');
          sent.push(message);
        },
      },
      { get: () => 'http://localhost:3000' } as unknown as ConfigService<never, true>,
    );
  });
  afterAll(() => database.close());

  beforeEach(async () => {
    sent = [];
    failSend = false;
    seq += 1;
    await database.db.delete(users);
    await database.db.delete(teams);
    owner = await newUser(`owner${seq}@example.com`, 'Ada');
    const [team] = await database.db
      .insert(teams)
      .values({ name: 'Studio <b>One</b>' })
      .returning();
    teamId = team?.id ?? '';
    await database.db.insert(memberships).values({ teamId, userId: owner.id, role: 'owner' });
  });

  async function newUser(email: string, name: string) {
    const [user] = await database.db.insert(users).values({ email, name }).returning();
    if (!user) throw new Error('seed failed');
    return user;
  }

  it('emails a link, stores only the hash, and expires in 7 days', async () => {
    const summary = await service.create(teamId, owner, {
      email: 'bob@example.com',
      role: 'editor',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('bob@example.com');
    expect(sent[0]?.text).toContain('http://localhost:3000/invite/');

    const [row] = await database.db.select().from(invites).where(eq(invites.id, summary.id));
    expect(row?.tokenHash).not.toContain(token(sent[0] as EmailMessage));
    const days = ((row?.expiresAt.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(INVITE_TTL_DAYS - 0.01);
    expect(days).toBeLessThanOrEqual(INVITE_TTL_DAYS);
  });

  it('escapes names in the HTML part', async () => {
    await service.create(teamId, owner, { email: 'bob@example.com', role: 'viewer' });
    expect(sent[0]?.html).toContain('Studio &lt;b&gt;One&lt;/b&gt;');
    expect(sent[0]?.html).not.toContain('<b>');
  });

  it('replaces the pending invite when the same email is invited again', async () => {
    await service.create(teamId, owner, { email: 'bob@example.com', role: 'viewer' });
    await service.create(teamId, owner, { email: 'bob@example.com', role: 'editor' });
    const bob = await newUser(`bob${seq}@example.com`, 'Bob');
    const stale = { ...bob, email: 'bob@example.com' };
    await expect(service.accept(token(sent[0] as EmailMessage), stale)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await service.accept(token(sent[1] as EmailMessage), stale);
    const [member] = await database.db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, bob.id));
    expect(member?.role).toBe('editor');
  });

  it('refuses to invite someone already on the team', async () => {
    await expect(
      service.create(teamId, owner, { email: owner.email, role: 'viewer' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sent).toHaveLength(0);
  });

  it('caps invites per team per hour', async () => {
    for (let i = 0; i < 20; i += 1) {
      await service.create(teamId, owner, { email: `p${i}@example.com`, role: 'viewer' });
    }
    await expect(
      service.create(teamId, owner, { email: 'one-more@example.com', role: 'viewer' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('drops the invite when the email cannot be sent', async () => {
    failSend = true;
    await expect(
      service.create(teamId, owner, { email: 'bob@example.com', role: 'viewer' }),
    ).rejects.toThrow('provider down');
    expect(await database.db.select().from(invites)).toEqual([]);
  });

  describe('accept', () => {
    async function invited(email: string, role: 'owner' | 'editor' | 'viewer' = 'editor') {
      await service.create(teamId, owner, { email, role });
      return token(sent.at(-1) as EmailMessage);
    }

    it('adds the member with the invited role and uses the invite up', async () => {
      const link = await invited('bob@example.com');
      const bob = await newUser('bob@example.com', 'Bob');

      expect(await service.accept(link, bob)).toEqual({ teamId });
      const [member] = await database.db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, bob.id));
      expect(member).toMatchObject({ teamId, role: 'editor' });
      await expect(service.accept(link, bob)).rejects.toBeInstanceOf(GoneException);
      expect((await service.preview(link, bob)).status).toBe('accepted');
    });

    it('refuses a different signed in email and leaves the invite usable', async () => {
      const link = await invited('bob@example.com');
      const eve = await newUser('eve@example.com', 'Eve');
      await expect(service.accept(link, eve)).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        await database.db.select().from(memberships).where(eq(memberships.userId, eve.id)),
      ).toEqual([]);

      const bob = await newUser('bob@example.com', 'Bob');
      await expect(service.accept(link, bob)).resolves.toEqual({ teamId });
    });

    it('refuses an expired invite', async () => {
      const link = await invited('bob@example.com');
      await database.db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) });
      const bob = await newUser('bob@example.com', 'Bob');
      await expect(service.accept(link, bob)).rejects.toBeInstanceOf(GoneException);
      expect((await service.preview(link, bob)).status).toBe('expired');
      expect(
        await database.db.select().from(memberships).where(eq(memberships.userId, bob.id)),
      ).toEqual([]);
    });

    it('answers 404 for a token that was never issued', async () => {
      const bob = await newUser('bob@example.com', 'Bob');
      const unknown = 'A'.repeat(43);
      await expect(service.accept(unknown, bob)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.preview(unknown, bob)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not change the role of someone who is already a member', async () => {
      const link = await invited('bob@example.com', 'viewer');
      const bob = await newUser('bob@example.com', 'Bob');
      await database.db.insert(memberships).values({ teamId, userId: bob.id, role: 'owner' });
      await service.accept(link, bob);
      const rows = await database.db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, bob.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.role).toBe('owner');
    });

    it('previews who invited you and whether your email matches', async () => {
      const link = await invited('bob@example.com');
      const bob = await newUser('bob@example.com', 'Bob');
      const eve = await newUser('eve@example.com', 'Eve');
      expect(await service.preview(link, bob)).toEqual({
        teamName: 'Studio <b>One</b>',
        invitedBy: 'Ada',
        email: 'bob@example.com',
        role: 'editor',
        status: 'pending',
        emailMatches: true,
      });
      expect((await service.preview(link, eve)).emailMatches).toBe(false);
    });
  });
});
