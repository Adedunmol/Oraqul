import { desc, eq, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { z } from 'zod';
import { type SampledPlan, tallyCannot } from '../agent/error-sample.js';
import { envSchema } from '../config/env.js';
import { outputs, projects } from '../db/schema.js';

// The weekly error review (decision D43): read the last N plans, list what each could not test, and
// count the items across them. Read only. `--limit=<n>` (30 to 100 is the routine), `--list` to
// print each plan as well as the counts.
const briefSchema = z.looseObject({
  cannot: z.array(z.object({ item: z.string(), why: z.string() })).default([]),
});
const planSchema = z.looseObject({ dropped: z.array(z.unknown()).default([]) });
const confidenceSchema = z.looseObject({ level: z.string().optional() });

async function main(): Promise<void> {
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 50);
  const env = envSchema.parse(process.env);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    const rows = await db
      .select({
        id: outputs.id,
        category: projects.category,
        headline: outputs.headline,
        brief: outputs.brief,
        plan: outputs.plan,
        confidence: outputs.confidence,
      })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(isNotNull(outputs.plan))
      .orderBy(desc(outputs.createdAt))
      .limit(limit);
    const sample: SampledPlan[] = rows.map((r) => ({
      id: r.id,
      category: r.category,
      headline: r.headline,
      confidence: confidenceSchema.safeParse(r.confidence).data?.level ?? null,
      cannot: briefSchema.safeParse(r.brief).data?.cannot ?? [],
      dropped: planSchema.safeParse(r.plan).data?.dropped.length ?? 0,
    }));
    if (process.argv.includes('--list')) {
      for (const p of sample) {
        console.log(
          `${p.id}  ${p.category ?? '-'}  ${p.confidence ?? '-'}  dropped ${p.dropped}  cannot: ${p.cannot.map((c) => c.item).join('; ') || '-'}`,
        );
      }
      console.log('');
    }
    console.log(`${sample.length} plans. Plans that could not test an item:`);
    for (const t of tallyCannot(sample)) {
      console.log(`${String(t.count).padStart(4)}  ${t.key}  (${t.why})`);
    }
    console.log(
      `\nPlans with a dropped line: ${sample.filter((p) => p.dropped > 0).length}; low confidence: ${sample.filter((p) => p.confidence === 'lower').length}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
