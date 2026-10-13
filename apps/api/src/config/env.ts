import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    WEB_ORIGIN: z.string().url(),
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
  .refine((env) => env.OPENAI_API_KEY === '' || env.OPENAI_MODEL !== '', {
    message: 'OPENAI_API_KEY needs OPENAI_MODEL',
    path: ['OPENAI_MODEL'],
  });

export type Env = z.infer<typeof envSchema>;
