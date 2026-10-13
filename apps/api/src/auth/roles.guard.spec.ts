import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Role, roles } from '@oraqul/schema';
import { createTestDatabase } from '../../test/test-database.js';
import { memberships, teams, users } from '../db/schema.js';
import { Roles, RolesGuard, type TeamRequest } from './roles.guard.js';

class Routes {
  @Roles('owner', 'editor', 'viewer')
  anyMember() {}

  @Roles('owner', 'editor')
  canWrite() {}

  @Roles('owner')
  ownerOnly() {}

  unmarked() {}
}

type RouteName = Exclude<keyof Routes, never>;

// Rows are routes, columns are roles. A route without @Roles() denies everyone.
const allowed: Record<RouteName, Record<Role, boolean>> = {
  anyMember: { owner: true, editor: true, viewer: true },
  canWrite: { owner: true, editor: true, viewer: false },
  ownerOnly: { owner: true, editor: false, viewer: false },
  unmarked: { owner: false, editor: false, viewer: false },
};

describe('RolesGuard', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let guard: RolesGuard;
  let teamId: string;
  let otherTeamId: string;
  const userIds = {} as Record<Role | 'stranger', string>;

  beforeAll(async () => {
    database = await createTestDatabase();
    guard = new RolesGuard(database.db, new Reflector());

    const [team, other] = await database.db
      .insert(teams)
      .values([{ name: 'Studio' }, { name: 'Other' }])
      .returning();
    teamId = team?.id ?? '';
    otherTeamId = other?.id ?? '';
    for (const role of [...roles, 'stranger'] as const) {
      const [user] = await database.db
        .insert(users)
        .values({ email: `${role}@example.com`, name: role })
        .returning();
      userIds[role] = user?.id ?? '';
      if (role !== 'stranger') {
        await database.db.insert(memberships).values({ teamId, userId: userIds[role], role });
      }
    }
  });
  afterAll(() => database.close());

  function run(route: RouteName, userId: string, params: Record<string, string>) {
    const request = { user: { id: userId }, params } as unknown as TeamRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => Routes.prototype[route],
      getClass: () => Routes,
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  }

  describe.each(Object.keys(allowed) as RouteName[])('%s', (route) => {
    it.each(roles)('%s', async (role) => {
      const { request, result } = run(route, userIds[role], { teamId });
      if (allowed[route][role]) {
        await expect(result).resolves.toBe(true);
        expect(request.membership).toEqual({ teamId, userId: userIds[role], role });
      } else {
        await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      }
    });
  });

  it('refuses a signed in person who is not on the team', async () => {
    await expect(run('anyMember', userIds.stranger, { teamId }).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an owner of one team on another team', async () => {
    await expect(
      run('ownerOnly', userIds.owner, { teamId: otherTeamId }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gives the same refusal for a team that does not exist and one that is not yours', async () => {
    const missing = run('anyMember', userIds.owner, {
      teamId: '5b0f0c1e-6f0a-4f0e-8d57-3b5a0d6a9c11',
    });
    const mine = run('anyMember', userIds.stranger, { teamId });
    await expect(missing.result).rejects.toThrow(new ForbiddenException());
    await expect(mine.result).rejects.toThrow(new ForbiddenException());
  });

  it('refuses a team id that is not a uuid without querying', async () => {
    await expect(
      run('anyMember', userIds.owner, { teamId: "1' or '1'='1" }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(run('anyMember', userIds.owner, {}).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
