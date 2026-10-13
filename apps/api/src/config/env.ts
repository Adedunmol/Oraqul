import { z } from 'zod';

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
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_MODEL: z.string().default(''),
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
  .refine((env) => env.OPENAI_API_KEY === '' || env.OPENAI_MODEL !== '', {
    message: 'OPENAI_API_KEY needs OPENAI_MODEL',
    path: ['OPENAI_MODEL'],
  });

export type Env = z.infer<typeof envSchema>;
