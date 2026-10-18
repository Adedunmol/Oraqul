import { Inject, Injectable } from '@nestjs/common';
import type { Receipt } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { outputs, receipts, threads } from '../db/schema.js';
import type { NewOutput } from './category-agents.js';

/** Saves what a run made: its receipts always, and its output when it made a plan (spec §6). */
@Injectable()
export class OutputStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Returns the new output's id, or null when the run made no output. */
  async save(input: {
    threadId: string;
    projectId: string;
    runId: string;
    output: NewOutput | null;
    receipts: Receipt[];
  }): Promise<string | null> {
    const { threadId, projectId, runId, output } = input;
    return this.db.transaction(async (tx) => {
      let outputId: string | null = null;
      if (output) {
        const [thread] = await tx
          .select({ baseOutputId: threads.baseOutputId })
          .from(threads)
          .where(eq(threads.id, threadId));
        const [row] = await tx
          .insert(outputs)
          .values({
            threadId,
            projectId,
            kind: output.kind,
            parentId: thread?.baseOutputId ?? null,
            title: output.title,
            brief: output.brief,
            plan: output.plan,
            headline: output.headline,
            moves: output.moves,
            confidence: output.confidence,
            inputs: output.inputs,
            dataAsOf: new Date(),
          })
          .returning({ id: outputs.id });
        if (!row) throw new Error('Output insert returned no row');
        outputId = row.id;
        // A date check or partner brief is built on the plan; it does not replace it.
        if (output.kind === 'build' || output.kind === 'scenario') {
          await tx
            .update(threads)
            .set({ baseOutputId: outputId, updatedAt: new Date() })
            .where(eq(threads.id, threadId));
        }
      }
      if (input.receipts.length) {
        await tx.insert(receipts).values(
          input.receipts.map((r) => ({
            runId,
            threadId,
            outputId,
            lineId: r.lineId ?? null,
            endpoint: r.endpoint,
            input: r.input,
            returned: r.returned,
            rule: r.rule,
            confidence: r.confidence,
            source: r.source,
            calledAt: new Date(r.calledAt),
            callId: r.callId,
          })),
        );
      }
      return outputId;
    });
  }
}
