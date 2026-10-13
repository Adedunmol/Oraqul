import { envSchema } from './env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(32),
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('envSchema', () => {
  it('applies defaults', () => {
    const env = envSchema.parse(valid);
    expect(env.PORT).toBe(4000);
    expect(env.QLOO_CALL_BUDGET).toBe(60);
  });

  it('rejects a short session secret', () => {
    expect(envSchema.safeParse({ ...valid, SESSION_SECRET: 'short' }).success).toBe(false);
  });
});
