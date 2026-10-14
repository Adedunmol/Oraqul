import { HttpException, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { CodesService } from '../src/auth/codes.service.js';
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
  const consume = vi.fn(async () => ({ purpose: 'signin', name: null, passwordHash: null }));
  const assertAllowed = vi.fn(async (): Promise<void> => undefined);
  const recordFailure = vi.fn(async (): Promise<void> => undefined);
  const clear = vi.fn(async (): Promise<void> => undefined);
  const findByEmail = vi.fn(async (): Promise<typeof user | undefined> => undefined);

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
      .overrideProvider(LoginLimiterService)
      .useValue({ assertAllowed, recordFailure, clear })
      .overrideProvider(UsersService)
      .useValue({
        findByEmail,
        findOrCreateVerified: async () => user,
        setPasswordIfMissing: async () => undefined,
        setPassword: async () => undefined,
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser(secret));
    await app.init();
  }

  beforeEach(() => {
    issue.mockClear();
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
});
