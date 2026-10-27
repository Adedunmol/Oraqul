import { ConflictException, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { createTestDatabase } from '../../test/test-database.js';
import { invites, memberships, users } from '../db/schema.js';
import { TeamsService } from './teams.service.js';

describe('TeamsService', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let service: TeamsService;
  let seq = 0;

  beforeAll(async () => {
    database = await createTestDatabase();
    service = new TeamsService(database.db);
  });
  afterAll(() => database.close());

  async function newUser(name: string) {
    seq += 1;
    const [user] = await database.db
      .insert(users)
      .values({ email: `${name.toLowerCase()}${seq}@example.com`, name })
      .returning();
    if (!user) throw new Error('seed failed');
    return user;
  }

  async function roleOf(teamId: string, userId: string) {
    const [row] = await database.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)));
    return row?.role;
  }

  it('creates a team the creator owns and lists it', async () => {
    const ada = await newUser('Ada');
    const team = await service.create(ada.id, 'Studio');
    expect(team).toMatchObject({ name: 'Studio', role: 'owner' });
    expect(await service.list(ada.id)).toEqual([team]);
  });

  it('lists only the teams the person belongs to', async () => {
    const ada = await newUser('Ada');
    const bob = await newUser('Bob');
    await service.create(ada.id, 'Ada only');
    expect(await service.list(bob.id)).toEqual([]);
  });

  it('renames a team and shows when each member joined', async () => {
    const ada = await newUser('Ada');
    const team = await service.create(ada.id, 'Studio');
    await service.rename(team.id, 'Studio Two');
    const detail = await service.detail(team.id, 'owner');
    expect(detail.team.name).toBe('Studio Two');
    expect(Date.parse(detail.members[0]?.joinedAt ?? '')).not.toBeNaN();
    await expect(
      service.rename('00000000-0000-4000-8000-000000000000', 'Nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('last owner rule', () => {
    it('refuses to demote the only owner', async () => {
      const ada = await newUser('Ada');
      const team = await service.create(ada.id, 'Studio');
      await expect(service.changeRole(team.id, ada.id, 'editor')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(await roleOf(team.id, ada.id)).toBe('owner');
    });

    it('refuses to remove the only owner', async () => {
      const ada = await newUser('Ada');
      const team = await service.create(ada.id, 'Studio');
      await expect(service.removeMember(team.id, ada.id)).rejects.toBeInstanceOf(ConflictException);
      expect((await service.detail(team.id, 'owner')).members).toHaveLength(1);
    });

    it('allows both once a second owner exists, then protects the remaining one', async () => {
      const ada = await newUser('Ada');
      const bob = await newUser('Bob');
      const team = await service.create(ada.id, 'Studio');
      await database.db
        .insert(memberships)
        .values({ teamId: team.id, userId: bob.id, role: 'editor' });

      await service.changeRole(team.id, bob.id, 'owner');
      await service.changeRole(team.id, ada.id, 'viewer');
      await expect(service.removeMember(team.id, bob.id)).rejects.toBeInstanceOf(ConflictException);
      await service.changeRole(team.id, ada.id, 'owner');
      await service.removeMember(team.id, bob.id);

      const { members } = await service.detail(team.id, 'owner');
      expect(members.map((member) => member.userId)).toEqual([ada.id]);
    });

    it('keeps one owner when two owners demote each other', async () => {
      const ada = await newUser('Ada');
      const bob = await newUser('Bob');
      const team = await service.create(ada.id, 'Studio');
      await database.db
        .insert(memberships)
        .values({ teamId: team.id, userId: bob.id, role: 'owner' });

      const results = await Promise.allSettled([
        service.changeRole(team.id, ada.id, 'viewer'),
        service.changeRole(team.id, bob.id, 'viewer'),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const { members } = await service.detail(team.id, 'owner');
      expect(members.filter((member) => member.role === 'owner')).toHaveLength(1);
    });

    it('does not count owners of another team', async () => {
      const ada = await newUser('Ada');
      const bob = await newUser('Bob');
      const first = await service.create(ada.id, 'First');
      await service.create(bob.id, 'Second');
      await database.db
        .insert(memberships)
        .values({ teamId: first.id, userId: bob.id, role: 'editor' });
      await expect(service.changeRole(first.id, ada.id, 'viewer')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('answers 404 for a member who is not on the team', async () => {
    const ada = await newUser('Ada');
    const bob = await newUser('Bob');
    const team = await service.create(ada.id, 'Studio');
    await expect(service.changeRole(team.id, bob.id, 'editor')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.removeMember(team.id, bob.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shows pending invites to owners only, and hides expired ones', async () => {
    const ada = await newUser('Ada');
    const team = await service.create(ada.id, 'Studio');
    await database.db.insert(invites).values([
      {
        teamId: team.id,
        email: 'live@example.com',
        role: 'editor',
        tokenHash: `live${seq}`,
        invitedBy: ada.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        teamId: team.id,
        email: 'old@example.com',
        role: 'viewer',
        tokenHash: `old${seq}`,
        invitedBy: ada.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]);
    const asOwner = await service.detail(team.id, 'owner');
    expect(asOwner.invites.map((invite) => invite.email)).toEqual(['live@example.com']);
    expect((await service.detail(team.id, 'editor')).invites).toEqual([]);
    expect((await service.detail(team.id, 'viewer')).invites).toEqual([]);
  });
});
