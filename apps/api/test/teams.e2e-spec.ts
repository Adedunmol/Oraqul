import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Role } from '@oraqul/schema';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { EMAIL_SENDER, type EmailMessage } from '../src/auth/email/email-sender.js';
import { type AuthedRequest, SessionGuard } from '../src/auth/session.guard.js';
import { UsersService } from '../src/auth/users.service.js';
import { envSchema } from '../src/config/env.js';
import { DB, DbModule } from '../src/db/db.module.js';
import { memberships } from '../src/db/schema.js';
import { TeamsModule } from '../src/teams/teams.module.js';
import { TeamsService } from '../src/teams/teams.service.js';
import { createTestDatabase } from './test-database.js';

const emails = {
  owner: 'owner@example.com',
  editor: 'editor@example.com',
  viewer: 'viewer@example.com',
  stranger: 'stranger@example.com',
  invitee: 'invitee@example.com',
} as const;

describe('teams (e2e, real guards and SQL, session lookup stubbed)', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let app: INestApplication<App>;
  let sent: EmailMessage[];
  let teamId: string;
  const ids = {} as Record<keyof typeof emails, string>;

  const as = (who: keyof typeof emails) => ({ 'x-test-user': emails[who] });

  beforeAll(async () => {
    database = await createTestDatabase();
    sent = [];
    const accounts = new UsersService(database.db);
    for (const [who, email] of Object.entries(emails)) {
      const user = await accounts.findOrCreateVerified(email, who);
      ids[who as keyof typeof emails] = user.id;
    }

    // Stands in for the cookie lookup only.
    const sessionStub = {
      canActivate: async (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<AuthedRequest>();
        const email = req.header('x-test-user');
        const user = email ? await accounts.findByEmail(email) : undefined;
        if (!user) throw new UnauthorizedException();
        req.user = user;
        return true;
      },
    };

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
        DbModule,
        AuthModule,
        TeamsModule,
      ],
    })
      .overrideProvider(DB)
      .useValue(database.db)
      .overrideProvider(EMAIL_SENDER)
      .useValue({ send: async (message: EmailMessage) => void sent.push(message) })
      .overrideGuard(SessionGuard)
      .useValue(sessionStub)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const team = await moduleRef.get(TeamsService).create(ids.owner, 'Studio');
    teamId = team.id;
    for (const role of ['editor', 'viewer'] as const) {
      await database.db.insert(memberships).values({ teamId, userId: ids[role], role });
    }
  });
  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it('answers 401 without a session on every route', async () => {
    const http = app.getHttpServer();
    await request(http).get('/teams').expect(401);
    await request(http).get(`/teams/${teamId}`).expect(401);
    await request(http)
      .get(`/invites/${'A'.repeat(43)}`)
      .expect(401);
  });

  it('lists the personal team created at sign up and the team they own', async () => {
    const res = await request(app.getHttpServer()).get('/teams').set(as('owner')).expect(200);
    expect(res.body.teams.map((team: { name: string }) => team.name)).toEqual([
      "owner's team",
      'Studio',
    ]);
    const stranger = await request(app.getHttpServer())
      .get('/teams')
      .set(as('stranger'))
      .expect(200);
    expect(stranger.body.teams).toHaveLength(1);
  });

  it('creates a team and rejects an empty name', async () => {
    const http = app.getHttpServer();
    const created = await request(http)
      .post('/teams')
      .set(as('stranger'))
      .send({ name: '  Label  ' })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Label', role: 'owner' });
    await request(http).post('/teams').set(as('stranger')).send({ name: '   ' }).expect(400);
  });

  describe('role matrix over HTTP', () => {
    // Statuses per caller. 204 and 201 are the success codes of the write routes.
    const matrix: Record<Role | 'stranger', { read: number; manage: number }> = {
      owner: { read: 200, manage: 201 },
      editor: { read: 200, manage: 403 },
      viewer: { read: 200, manage: 403 },
      stranger: { read: 403, manage: 403 },
    };

    it.each(Object.entries(matrix))('%s', async (who, expected) => {
      const caller = who as keyof typeof matrix;
      const http = app.getHttpServer();
      await request(http).get(`/teams/${teamId}`).set(as(caller)).expect(expected.read);
      await request(http)
        .post(`/teams/${teamId}/invites`)
        .set(as(caller))
        .send({ email: `from-${who}@example.com`, role: 'viewer' })
        .expect(expected.manage);
      const forbidden = expected.manage === 403;
      await request(http)
        .patch(`/teams/${teamId}/members/${ids.viewer}`)
        .set(as(caller))
        .send({ role: 'viewer' })
        .expect(forbidden ? 403 : 204);
      if (forbidden) {
        await request(http)
          .delete(`/teams/${teamId}/members/${ids.viewer}`)
          .set(as(caller))
          .expect(403);
      }
    });
  });

  it('shows pending invites to owners only', async () => {
    const http = app.getHttpServer();
    const asOwner = await request(http).get(`/teams/${teamId}`).set(as('owner')).expect(200);
    expect(asOwner.body.myRole).toBe('owner');
    expect(asOwner.body.invites.length).toBeGreaterThan(0);
    const asEditor = await request(http).get(`/teams/${teamId}`).set(as('editor')).expect(200);
    expect(asEditor.body.myRole).toBe('editor');
    expect(asEditor.body.invites).toEqual([]);
  });

  it('keeps a team from losing its last owner', async () => {
    const http = app.getHttpServer();
    await request(http)
      .patch(`/teams/${teamId}/members/${ids.owner}`)
      .set(as('owner'))
      .send({ role: 'editor' })
      .expect(409);
    await request(http)
      .delete(`/teams/${teamId}/members/${ids.owner}`)
      .set(as('owner'))
      .expect(409);
  });

  it('rejects a role outside the list and a member id that is not a uuid', async () => {
    const http = app.getHttpServer();
    await request(http)
      .patch(`/teams/${teamId}/members/${ids.viewer}`)
      .set(as('owner'))
      .send({ role: 'admin' })
      .expect(400);
    await request(http).delete(`/teams/${teamId}/members/not-a-uuid`).set(as('owner')).expect(400);
  });

  it('removes a member and then refuses them', async () => {
    const http = app.getHttpServer();
    await request(http)
      .delete(`/teams/${teamId}/members/${ids.viewer}`)
      .set(as('owner'))
      .expect(204);
    await request(http).get(`/teams/${teamId}`).set(as('viewer')).expect(403);
    await request(http)
      .delete(`/teams/${teamId}/members/${ids.viewer}`)
      .set(as('owner'))
      .expect(404);
  });

  describe('invite link', () => {
    let token: string;

    beforeAll(async () => {
      sent.length = 0;
      await request(app.getHttpServer())
        .post(`/teams/${teamId}/invites`)
        .set(as('owner'))
        .send({ email: 'Invitee@Example.com', role: 'editor' })
        .expect(201);
      token = sent[0]?.text.match(/\/invite\/([\w-]{43})/)?.[1] ?? '';
    });

    it('went out by email to the lower cased address', () => {
      expect(sent[0]?.to).toBe(emails.invitee);
      expect(token).toHaveLength(43);
    });

    it('shows a preview, and flags a signed in email that does not match', async () => {
      const http = app.getHttpServer();
      const mine = await request(http).get(`/invites/${token}`).set(as('invitee')).expect(200);
      expect(mine.body).toMatchObject({ teamName: 'Studio', role: 'editor', emailMatches: true });
      const other = await request(http).get(`/invites/${token}`).set(as('stranger')).expect(200);
      expect(other.body.emailMatches).toBe(false);
    });

    it('rejects a token with the wrong shape and one nobody issued', async () => {
      const http = app.getHttpServer();
      await request(http).get('/invites/short').set(as('invitee')).expect(400);
      await request(http)
        .get(`/invites/${'A'.repeat(43)}`)
        .set(as('invitee'))
        .expect(404);
    });

    it('refuses the wrong account, then lets the right one in once', async () => {
      const http = app.getHttpServer();
      await request(http).post(`/invites/${token}/accept`).set(as('stranger')).expect(403);
      const accepted = await request(http)
        .post(`/invites/${token}/accept`)
        .set(as('invitee'))
        .expect(200);
      expect(accepted.body).toEqual({ teamId });

      await request(http).post(`/invites/${token}/accept`).set(as('invitee')).expect(410);
      const [row] = await database.db
        .select()
        .from(memberships)
        .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, ids.invitee)));
      expect(row?.role).toBe('editor');
      const detail = await request(http).get(`/teams/${teamId}`).set(as('invitee')).expect(200);
      expect(detail.body.myRole).toBe('editor');
    });
  });
});
