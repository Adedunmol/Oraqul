import { HttpException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { CodesService } from '../src/auth/codes.service.js';
import { EMAIL_SENDER } from '../src/auth/email/email-sender.js';
import { LoginLimiterService } from '../src/auth/login-limiter.service.js';
import { hashPassword } from '../src/auth/password.js';
import { UsersService } from '../src/auth/users.service.js';
import { envSchema } from '../src/config/env.js';
import { DB, DbModule } from '../src/db/db.module.js';

const secret = 'x'.repeat(32);
const sessionId = '6f1f2b9e-3a0c-4d7e-9b52-2f7e0c1a8d44';
const user = {
  id: '0b7e7f0e-8c58-4d2f-8d0f-5a3c1d9b7a10',
  email: 'ada@example.com',
  name: 'Ada',
  passwordHash: null as string | null,
  emailVerifiedAt: new Date() as Date | null,
  createdAt: new Date(),
};

const sessionsLookup = (rows: unknown[]) => ({
  select: () => ({
    from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => rows }) }) }),
  }),
});

function fakeDb(rows: unknown[] = []) {
  return {
    ...sessionsLookup(rows),
    insert: () => ({ values: () => ({ returning: async () => [{ id: sessionId }] }) }),
    delete: () => ({ where: async () => undefined }),
  };
}

describe('auth (e2e, services stubbed)', () => {
  let app: INestApplication<App>;
  const issue = vi.fn(async () => '123456');
  const consume = vi.fn(async () => ({ purpose: 'signin' }));
  const assertAllowed = vi.fn(async (): Promise<void> => undefined);
  const recordFailure = vi.fn(async (): Promise<void> => undefined);
  const clear = vi.fn(async (): Promise<void> => undefined);
  const hasOAuthAccount = vi.fn(async () => true);
  const findByEmail = vi.fn(async (): Promise<typeof user | undefined> => undefined);

  const createUnverified = vi.fn(
    async (): Promise<typeof user> => ({ ...user, emailVerifiedAt: null }),
  );
  const setPassword = vi.fn(async (): Promise<void> => undefined);
  const send = vi.fn(async (): Promise<void> => undefined);

  async function boot(db: object) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            envSchema.parse({
              DATABASE_URL: 'postgres://u:p@localhost:5433/db',
              SESSION_SECRET: secret,
              WEB_ORIGIN: 'http://localhost:3000',
            }),
        }),
        DbModule,
        AuthModule,
      ],
    })
      .overrideProvider(DB)
      .useValue(db)
      .overrideProvider(CodesService)
      .useValue({ issue, consume })
      .overrideProvider(EMAIL_SENDER)
      .useValue({ send })
      .overrideProvider(LoginLimiterService)
      .useValue({ assertAllowed, recordFailure, clear })
      .overrideProvider(UsersService)
      .useValue({
        findByEmail,
        hasOAuthAccount,
        findOrCreateVerified: async () => user,
        createUnverified,
        confirmSignupEmail: async () => user,
        updateName: async (_id: string, name: string) => ({ ...user, name }),
        setPassword,
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser(secret));
    await app.init();
  }

  beforeEach(() => {
    issue.mockClear();
    send.mockClear();
    setPassword.mockClear();
    createUnverified.mockClear();
    assertAllowed.mockReset().mockResolvedValue(undefined);
    recordFailure.mockClear();
    clear.mockClear();
    findByEmail.mockClear();
    findByEmail.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers /auth/me with 401 and no cookie', async () => {
    await boot(fakeDb());
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('verifying a code sets an HttpOnly signed session cookie', async () => {
    await boot(fakeDb());
    const res = await request(app.getHttpServer())
      .post('/auth/code/verify')
      .send({ email: 'Ada@Example.com', code: '123456' })
      .expect(200);
    expect(res.body.user.email).toBe('ada@example.com');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/oraqul_session=s%3A/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('serves /auth/me for a signed session cookie', async () => {
    await boot(fakeDb([{ user }]));
    const login = await request(app.getHttpServer())
      .post('/auth/code/verify')
      .send({ email: 'ada@example.com', code: '123456' });
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', login.headers['set-cookie'] ?? [])
      .expect(200);
    expect(res.body.user.name).toBe('Ada');
  });

  it('rejects bad bodies with 400', async () => {
    await boot(fakeDb());
    const http = app.getHttpServer();
    await request(http)
      .post('/auth/signup')
      .send({ name: 'A', email: 'nope', password: 'longenough' })
      .expect(400);
    await request(http)
      .post('/auth/signup')
      .send({ name: 'A', email: 'a@b.co', password: 'short' })
      .expect(400);
    await request(http).post('/auth/code/verify').send({ email: 'a@b.co', code: '12' }).expect(400);
  });

  it('returns 202 for a reset request on an unknown email without sending', async () => {
    await boot(fakeDb());
    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ email: 'ghost@example.com' })
      .expect(202);
    expect(issue).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the reset code only to an account that exists', async () => {
    await boot(fakeDb());
    findByEmail.mockResolvedValue({ ...user, passwordHash: null });
    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ email: 'ada@example.com' })
      .expect(202);
    expect(send).toHaveBeenCalledOnce();
  });

  it('tells a Google account to sign in with Google, not that the password is wrong', async () => {
    await boot(fakeDb());
    findByEmail.mockResolvedValue({ ...user, passwordHash: null });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'whatever1' })
      .expect(401);
    expect(res.body.message).toMatch(/Google/);
  });

  it('gives the same 401 for an unknown email and a wrong password', async () => {
    await boot(fakeDb());
    const http = app.getHttpServer();
    const unknown = await request(http)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever1' });
    findByEmail.mockResolvedValue({ ...user, passwordHash: await hashPassword('rightpass1') });
    const wrong = await request(http)
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'wrongpass1' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('logs in with the right password', async () => {
    await boot(fakeDb());
    findByEmail.mockResolvedValue({ ...user, passwordHash: await hashPassword('rightpass1') });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'rightpass1' })
      .expect(200);
  });

  it('records a failure on a wrong password and clears failures on success', async () => {
    await boot(fakeDb());
    findByEmail.mockResolvedValue({ ...user, passwordHash: await hashPassword('rightpass1') });
    const http = app.getHttpServer();
    await request(http)
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'wrongpass1' })
      .expect(401);
    expect(recordFailure).toHaveBeenCalledWith('ada@example.com', expect.any(String));
    expect(clear).not.toHaveBeenCalled();
    await request(http)
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'rightpass1' })
      .expect(200);
    expect(clear).toHaveBeenCalledWith('ada@example.com', expect.any(String));
  });

  it('answers 429 without checking the password once the limit is hit', async () => {
    await boot(fakeDb());
    assertAllowed.mockRejectedValue(new HttpException('Too many', 429));
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'rightpass1' })
      .expect(429);
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('sends Google sign in back to the web app when Google is not configured', async () => {
    await boot(fakeDb());
    const res = await request(app.getHttpServer()).get('/auth/google').expect(302);
    expect(res.headers.location).toBe('http://localhost:3000/sign-in?error=google');
  });

  it('rejects a Google next path that leaves the site', async () => {
    await boot(fakeDb());
    await request(app.getHttpServer()).get('/auth/google?next=//evil.com').expect(400);
  });

  it('signup starts a session right away and emails a link and a code', async () => {
    await boot(fakeDb());
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Ada', email: 'Ada@Example.com', password: 'longenough' })
      .expect(201);
    expect(res.body.user).toMatchObject({ email: 'ada@example.com', emailVerified: false });
    expect(String(res.headers['set-cookie'])).toMatch(/oraqul_session=s%3A/);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'http://localhost:3000/verify?email=ada%40example.com&code=123456',
        ),
      }),
    );
  });

  it('signup still succeeds when the email cannot be sent', async () => {
    await boot(fakeDb());
    send.mockRejectedValueOnce(new HttpException('provider down', 502));
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'longenough' })
      .expect(201);
  });

  it('signup answers 409 for an email that already has an account', async () => {
    await boot(fakeDb());
    createUnverified.mockRejectedValueOnce(new HttpException('taken', 409));
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'longenough' })
      .expect(409);
  });

  it('resends the confirmation only to an unverified signed in account', async () => {
    await boot(fakeDb([{ user: { ...user, emailVerifiedAt: null } }]));
    const http = app.getHttpServer();
    const signup = await request(http)
      .post('/auth/signup')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'longenough' });
    send.mockClear();
    await request(http)
      .post('/auth/verification')
      .set('Cookie', signup.headers['set-cookie'] ?? [])
      .expect(202);
    expect(send).toHaveBeenCalledOnce();
    await request(http).post('/auth/verification').expect(401);
  });

  it('does not resend to an account that is already confirmed', async () => {
    await boot(fakeDb([{ user }]));
    const http = app.getHttpServer();
    const login = await request(http)
      .post('/auth/code/verify')
      .send({ email: 'ada@example.com', code: '123456' });
    send.mockClear();
    await request(http)
      .post('/auth/verification')
      .set('Cookie', login.headers['set-cookie'] ?? [])
      .expect(202);
    expect(send).not.toHaveBeenCalled();
  });

  describe('account settings', () => {
    async function signedIn(row: object) {
      await boot(fakeDb([{ user: row }]));
      const login = await request(app.getHttpServer())
        .post('/auth/code/verify')
        .send({ email: 'ada@example.com', code: '123456' });
      return login.headers['set-cookie'] ?? [];
    }

    it('renames the signed in person and rejects an empty name', async () => {
      const cookie = await signedIn(user);
      const http = app.getHttpServer();
      const res = await request(http)
        .patch('/auth/me')
        .set('Cookie', cookie)
        .send({ name: '  Ada L  ' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Ada L');
      await request(http).patch('/auth/me').set('Cookie', cookie).send({ name: '  ' }).expect(400);
      await request(http).patch('/auth/me').send({ name: 'Ada' }).expect(401);
    });

    it('changes a password only with the current one, and counts wrong guesses', async () => {
      const cookie = await signedIn({ ...user, passwordHash: await hashPassword('rightpass1') });
      const http = app.getHttpServer();
      await request(http)
        .post('/auth/password/change')
        .set('Cookie', cookie)
        .send({ currentPassword: 'wrongpass1', newPassword: 'brandnewpass1' })
        .expect(400);
      expect(recordFailure).toHaveBeenCalled();
      expect(setPassword).not.toHaveBeenCalled();
      const ok = await request(http)
        .post('/auth/password/change')
        .set('Cookie', cookie)
        .send({ currentPassword: 'rightpass1', newPassword: 'brandnewpass1' })
        .expect(200);
      expect(setPassword).toHaveBeenCalledOnce();
      expect(ok.body.user.hasPassword).toBe(true);
      expect(String(ok.headers['set-cookie'])).toMatch(/oraqul_session=/);
    });

    it('lets an account with no password set its first one', async () => {
      const cookie = await signedIn(user);
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Cookie', cookie)
        .send({ newPassword: 'brandnewpass1' })
        .expect(200);
      expect(setPassword).toHaveBeenCalledOnce();
    });

    it('refuses a short new password', async () => {
      const cookie = await signedIn(user);
      await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Cookie', cookie)
        .send({ newPassword: 'short' })
        .expect(400);
    });
  });
});
