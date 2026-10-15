import { z } from 'zod';

/** Model providers the API can call. Picking one is configuration, not code (docs/backend/llm.md). */
export const llmProviders = ['openai', 'google', 'openai-compatible'] as const;

export const envSchema = z
  .object({
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
    QLOO_CALL_BUDGET: z.coerce.number().int().positive().default(60),
    QLOO_MODE: z.enum(['demo', 'live']).default('demo'),
    AGENT_MAX_STEPS: z.coerce.number().int().positive().default(12),
    LLM_PROVIDER: z.enum(llmProviders).default('openai'),
    LLM_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().default(''),
    /** Optional: a cheaper or faster model for the router than for the category agents. */
    LLM_ROUTER_MODEL: z.string().default(''),
    LLM_BASE_URL: z.string().default(''),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  })
  .refine(
    (env) => env.QLOO_MODE === 'demo' || (env.QLOO_API_KEY !== '' && env.QLOO_BASE_URL !== ''),
    {
      message: 'QLOO_MODE=live needs QLOO_API_KEY and QLOO_BASE_URL',
      path: ['QLOO_MODE'],
    },
  )
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
  .refine(
    (env) =>
      env.LLM_API_KEY === '' ||
      env.LLM_PROVIDER !== 'openai-compatible' ||
      z.url().safeParse(env.LLM_BASE_URL).success,
    { message: 'LLM_PROVIDER=openai-compatible needs LLM_BASE_URL', path: ['LLM_BASE_URL'] },
  );

export type Env = z.infer<typeof envSchema>;
