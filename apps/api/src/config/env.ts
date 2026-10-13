import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().default(4000),
  QLOO_API_KEY: z.string().default(''),
  QLOO_BASE_URL: z.string().default(''),
  QLOO_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  QLOO_CALL_BUDGET: z.coerce.number().int().positive().default(60),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;
