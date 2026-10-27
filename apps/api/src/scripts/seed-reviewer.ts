import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { UsersService } from '../auth/users.service.js';
import { envSchema } from '../config/env.js';
import * as schema from '../db/schema.js';

// A reviewer's account with its own run cap, so anyone evaluating the product can try a real run
// without being able to spend the month's Qloo budget. The email, password and cap come from the
// environment, never from the repo. Running it again updates the same account.

const reviewer = z.object({
  REVIEWER_EMAIL: z.email(),
  REVIEWER_PASSWORD: z.string().min(12, 'REVIEWER_PASSWORD needs at least 12 characters'),
  REVIEWER_NAME: z.string().default('Reviewer'),
  REVIEWER_RUN_CAP: z.coerce.number().int().positive().default(3),
});

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const who = reviewer.parse(process.env);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    const users = new UsersService(db);
    const user = await users.findOrCreateVerified(who.REVIEWER_EMAIL, who.REVIEWER_NAME);
    await users.setPassword(user.id, await hashPassword(who.REVIEWER_PASSWORD));
    await db
      .update(schema.users)
      .set({ runCap: who.REVIEWER_RUN_CAP })
      .where(eq(schema.users.id, user.id));
    console.log(
      `${who.REVIEWER_EMAIL} can sign in and start ${who.REVIEWER_RUN_CAP} runs a month.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
