import { z } from 'zod';

/** Model providers the API can call. Picking one is configuration, not code (docs/backend/llm.md). */
export const llmProviders = ['openai', 'google', 'openai-compatible'] as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    WEB_ORIGIN: z.string().url(),
    API_ORIGIN: z
      .string()
      .url()
      .refine((value) => new URL(value).pathname === '/' && !value.endsWith('/'), {
        message: 'API_ORIGIN is an origin only, with no path or trailing slash',
      })
      .default('http://localhost:4000'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    COOKIE_DOMAIN: z.string().default(''),
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    BREVO_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default(''),
    PORT: z.coerce.number().int().default(4000),
    QLOO_API_KEY: z.string().default(''),
    QLOO_BASE_URL: z.string().default(''),
    QLOO_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    QLOO_CALL_BUDGET: z.coerce.number().int().positive().default(80),
    /** Qloo requests in flight across all runs together. The development host 429s above about 2. */
    QLOO_MAX_CONCURRENT: z.coerce.number().int().positive().default(2),
    /** Qloo calls a month across every run. A development key is about 10,000 (docs/backend/qloo.md). */
    QLOO_MONTHLY_BUDGET: z.coerce.number().int().positive().default(10_000),
    /** Part of the month kept for people in the web app: connected agents and watches stop short of it. */
    QLOO_INTERACTIVE_RESERVE: z.coerce.number().int().min(0).default(3_000),
    /** Runs that ask Qloo, per person per calendar month. A person's own `run_cap` overrides it. */
    RUN_CAP_PER_USER_MONTH: z.coerce.number().int().positive().default(20),
    QLOO_MODE: z.enum(['demo', 'live']).default('demo'),
    /** The commit the server was built from; saved on every plan. Empty in development. */
    CODE_VERSION: z.string().default(''),
    AGENT_MAX_STEPS: z.coerce.number().int().positive().default(12),
    // The Guide's help bot is public, so it has its own free Gemini key and its own limits, and
    // never spends the key that runs plans (docs/backend/llm.md).
    GUIDE_BOT_API_KEY: z.string().default(''),
    GUIDE_BOT_MODEL: z.string().default('gemini-3.5-flash-lite'),
    GUIDE_BOT_HOURLY_LIMIT: z.coerce.number().int().positive().default(12),
    GUIDE_BOT_DAILY_CAP: z.coerce.number().int().positive().default(400),
    LLM_PROVIDER: z.enum(llmProviders).default('openai'),
    LLM_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().default(''),
    /** Optional: a cheaper or faster model for the router than for the category agents. */
    LLM_ROUTER_MODEL: z.string().default(''),
    LLM_BASE_URL: z.string().default(''),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
    // The step that writes plans and answers can run on a stronger model, even from another
    // provider. Each value falls back to the main setting when empty.
    // An empty value, as in .env.example, means the writer uses the main provider.
    LLM_WRITER_PROVIDER: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(llmProviders).optional(),
    ),
    LLM_WRITER_API_KEY: z.string().default(''),
    LLM_WRITER_MODEL: z.string().default(''),
    LLM_WRITER_BASE_URL: z.string().default(''),
    // How hard an OpenAI reasoning model thinks before writing. Lower is faster and cheaper.
    LLM_WRITER_REASONING: z.enum(['minimal', 'low', 'medium', 'high']).default('low'),
    // Web search for release timing and market facts, through the writer's provider.
    LLM_WEB_SEARCH: z.enum(['on', 'off']).default('on'),
    // A whole plan is a long answer, so the writer gets more time than a short read.
    LLM_WRITER_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  })
  .refine(
    (env) => env.QLOO_MODE === 'demo' || (env.QLOO_API_KEY !== '' && env.QLOO_BASE_URL !== ''),
    {
      message: 'QLOO_MODE=live needs QLOO_API_KEY and QLOO_BASE_URL',
      path: ['QLOO_MODE'],
    },
  )
  // Demo data is made up. A deploy that forgot QLOO_MODE would otherwise serve it as plans.
  .refine((env) => env.NODE_ENV !== 'production' || env.QLOO_MODE === 'live', {
    message: 'NODE_ENV=production needs QLOO_MODE=live',
    path: ['QLOO_MODE'],
  })
  .refine((env) => (env.GOOGLE_CLIENT_ID === '') === (env.GOOGLE_CLIENT_SECRET === ''), {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET go together',
    path: ['GOOGLE_CLIENT_SECRET'],
  })
  // Brevo accepts a message from an unverified sender and then drops it, so a wrong address looks
  // like success. Refuse to start instead.
  .refine((env) => env.BREVO_API_KEY === '' || z.email().safeParse(env.EMAIL_FROM).success, {
    message: 'BREVO_API_KEY needs EMAIL_FROM set to a sender verified in Brevo',
    path: ['EMAIL_FROM'],
  })
  .refine((env) => env.LLM_API_KEY === '' || env.LLM_MODEL !== '', {
    message: 'LLM_API_KEY needs LLM_MODEL',
    path: ['LLM_MODEL'],
  })
  // A key belongs to one provider. Without this, a writer on another provider would be sent the
  // main provider's key.
  .refine(
    (env) =>
      env.LLM_WRITER_PROVIDER === undefined ||
      env.LLM_WRITER_PROVIDER === env.LLM_PROVIDER ||
      env.LLM_WRITER_API_KEY !== '',
    {
      message:
        'LLM_WRITER_PROVIDER differs from LLM_PROVIDER, so it needs its own LLM_WRITER_API_KEY',
      path: ['LLM_WRITER_API_KEY'],
    },
  )
  .refine(
    (env) =>
      env.LLM_API_KEY === '' ||
      env.LLM_PROVIDER !== 'openai-compatible' ||
      z.url().safeParse(env.LLM_BASE_URL).success,
    { message: 'LLM_PROVIDER=openai-compatible needs LLM_BASE_URL', path: ['LLM_BASE_URL'] },
  );

export type Env = z.infer<typeof envSchema>;
