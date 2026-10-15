import { and, asc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { userBody } from '../agent/thread-store.js';
import { createTitler, UNNAMED_THREAD } from '../agent/titler.js';
import { envSchema } from '../config/env.js';
import { messages, threads } from '../db/schema.js';
import { createLlm } from '../llm/llm.js';

// Chats made before chats were named from their first message kept a default name. This renames
// them once. Names a person could have chosen are not in this list, so they are never touched.
const DEFAULT_NAMES = [UNNAMED_THREAD, 'First plan', 'First check', 'First fix'];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const env = envSchema.parse(process.env);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);
  const titler = createTitler(createLlm(env), (err) =>
    console.warn(`Model titler failed, naming the chat the scripted way: ${err}`),
  );

  try {
    const named = await db
      .select({ id: threads.id, name: threads.name })
      .from(threads)
      .where(inArray(threads.name, DEFAULT_NAMES));
    let renamed = 0;
    for (const thread of named) {
      const [first] = await db
        .select({ body: messages.body })
        .from(messages)
        .where(and(eq(messages.threadId, thread.id), eq(messages.role, 'user')))
        .orderBy(asc(messages.seq))
        .limit(1);
      if (!first) continue;
      const { text, attachments } = userBody.parse(first.body);
      const name = await titler.title({ text, files: attachments.map((a) => a.name) });
      if (name === thread.name) continue;
      console.log(`${thread.id}  ${thread.name} → ${name}`);
      if (!dryRun) {
        await db
          .update(threads)
          .set({ name })
          .where(and(eq(threads.id, thread.id), eq(threads.name, thread.name)));
      }
      renamed++;
    }
    console.log(
      `${dryRun ? 'Would rename' : 'Renamed'} ${renamed} of ${named.length} chats with a default name.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
