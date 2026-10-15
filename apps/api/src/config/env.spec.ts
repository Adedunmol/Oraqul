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

describe('envSchema agent settings', () => {
  it('defaults to demo mode with no keys', () => {
    expect(envSchema.parse(valid).QLOO_MODE).toBe('demo');
  });

  it('rejects live mode without a Qloo key', () => {
    expect(envSchema.safeParse({ ...valid, QLOO_MODE: 'live' }).success).toBe(false);
  });

  it('rejects a model key with no model', () => {
    expect(envSchema.safeParse({ ...valid, LLM_API_KEY: 'sk-x' }).success).toBe(false);
  });

  it('needs a base URL for an OpenAI compatible provider', () => {
    const llm = { LLM_API_KEY: 'k', LLM_MODEL: 'm', LLM_PROVIDER: 'openai-compatible' };
    expect(envSchema.safeParse({ ...valid, ...llm }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...valid, ...llm, LLM_BASE_URL: 'http://localhost:11434/v1' }).success,
    ).toBe(true);
  });

  it('accepts a Google model', () => {
    const env = envSchema.parse({
      ...valid,
      LLM_PROVIDER: 'google',
      LLM_API_KEY: 'k',
      LLM_MODEL: 'gemini-2.5-flash',
    });
    expect(env.LLM_PROVIDER).toBe('google');
  });
});

describe('envSchema sign in settings', () => {
  it('rejects a Google client id without a secret', () => {
    expect(envSchema.safeParse({ ...valid, GOOGLE_CLIENT_ID: 'id' }).success).toBe(false);
  });

  it('accepts Google settings given together', () => {
    const env = envSchema.parse({
      ...valid,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    });
    expect(env.GOOGLE_CLIENT_ID).toBe('id');
  });

  it('rejects an API_ORIGIN that includes a path', () => {
    expect(
      envSchema.safeParse({ ...valid, API_ORIGIN: 'http://localhost:4000/auth/google/callback' })
        .success,
    ).toBe(false);
    expect(envSchema.safeParse({ ...valid, API_ORIGIN: 'http://localhost:4000/' }).success).toBe(
      false,
    );
    expect(envSchema.safeParse({ ...valid, API_ORIGIN: 'http://localhost:4000' }).success).toBe(
      true,
    );
  });

  it('needs a sender address once a Brevo key is set', () => {
    expect(envSchema.safeParse({ ...valid, BREVO_API_KEY: 'key' }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...valid, BREVO_API_KEY: 'key', EMAIL_FROM: 'hi@example.com' }).success,
    ).toBe(true);
  });

  it('runs with no Google or Brevo settings', () => {
    const env = envSchema.parse(valid);
    expect(env.BREVO_API_KEY).toBe('');
    expect(env.COOKIE_DOMAIN).toBe('');
  });
});
