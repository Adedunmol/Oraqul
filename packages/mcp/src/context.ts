import { demoFetch, QlooClient, type ToolContext } from '@oraqul/engine';
import { z } from 'zod';

const envSchema = z
  .object({
    QLOO_MODE: z.enum(['demo', 'live']).default('demo'),
    QLOO_API_KEY: z.string().default(''),
    QLOO_BASE_URL: z.string().default(''),
    QLOO_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    QLOO_CALL_BUDGET: z.coerce.number().int().positive().default(60),
  })
  .refine(
    (env) => env.QLOO_MODE === 'demo' || (env.QLOO_API_KEY !== '' && env.QLOO_BASE_URL !== ''),
    {
      message: 'QLOO_MODE=live needs QLOO_API_KEY and QLOO_BASE_URL',
    },
  );

/** Same variables as the API. Demo mode is the default so the server runs with no key. */
export function contextFromEnv(raw: NodeJS.ProcessEnv): ToolContext {
  const env = envSchema.parse(raw);
  if (env.QLOO_MODE === 'demo') {
    const qloo = new QlooClient({
      baseUrl: 'https://demo.invalid',
      apiKey: 'demo',
      fetch: demoFetch,
      callBudget: env.QLOO_CALL_BUDGET,
    });
    return { qloo, source: 'demo' };
  }
  const qloo = new QlooClient({
    baseUrl: env.QLOO_BASE_URL,
    apiKey: env.QLOO_API_KEY,
    timeoutMs: env.QLOO_TIMEOUT_MS,
    callBudget: env.QLOO_CALL_BUDGET,
  });
  return { qloo, source: 'qloo' };
}
