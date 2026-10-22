import { and, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { costRows, formatCostRows } from '../agent/cost-report.js';
import { envSchema } from '../config/env.js';
import { runs } from '../db/schema.js';

// What one run costs, per category and kind of run (decision D50): Qloo calls against the budget,
// tokens, time, and dollars when `--price-per-million-tokens=<n>` is given. Tokens are one number
// per run, so the dollars are an estimate. Read only.
async function main(): Promise<void> {
  const price = process.argv
    .find((a) => a.startsWith('--price-per-million-tokens='))
    ?.split('=')[1];
  const env = envSchema.parse(process.env);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    const rows = await db
      .select({
        agent: runs.agent,
        job: runs.job,
        qlooCalls: runs.qlooCalls,
        tokens: runs.tokens,
        createdAt: runs.createdAt,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .where(and(isNotNull(runs.finishedAt)));
    const done = rows.flatMap((r) =>
      r.finishedAt
        ? [
            {
              agent: r.agent,
              job: r.job,
              qlooCalls: r.qlooCalls,
              tokens: r.tokens,
              wallMs: r.finishedAt.getTime() - r.createdAt.getTime(),
            },
          ]
        : [],
    );
    console.log(formatCostRows(costRows(done, price ? Number(price) : null)));
    console.log(`\nCall budget per run: ${env.QLOO_CALL_BUDGET}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
