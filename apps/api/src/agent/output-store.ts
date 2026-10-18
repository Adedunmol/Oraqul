import { Inject, Injectable } from '@nestjs/common';
import type { Receipt } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { outputs, receipts, threads } from '../db/schema.js';
import type { NewOutput } from './category-agents.js';

/** Saves what a run made: its receipts always, and its outputs when it made a plan (spec §6). */
@Injectable()
export class OutputStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Returns the ids of the new outputs, oldest first. Each output is the child of the one before
   * it, and the first is the child of the chat's current plan.
   */
  async save(input: {
    threadId: string;
    projectId: string;
    runId: string;
    outputs: NewOutput[];
    receipts: Receipt[];
  }): Promise<string[]> {
    const { threadId, projectId, runId } = input;
    return this.db.transaction(async (tx) => {
      const ids: string[] = [];
      const [thread] = await tx
        .select({ baseOutputId: threads.baseOutputId })
        .from(threads)
        .where(eq(threads.id, threadId));
      let parentId = thread?.baseOutputId ?? null;
      for (const output of input.outputs) {
        const [row] = await tx
          .insert(outputs)
          .values({
            threadId,
            projectId,
            kind: output.kind,
            parentId,
            title: output.title,
            brief: output.brief,
            plan: output.plan,
            report: output.report,
            headline: output.headline,
            moves: output.moves,
            confidence: output.confidence,
            inputs: output.inputs,
            dataAsOf: new Date(),
          })
          .returning({ id: outputs.id });
        if (!row) throw new Error('Output insert returned no row');
        ids.push(row.id);
        parentId = row.id;
        // A date check or partner brief is built on the plan; it does not replace it.
        if (BASES.includes(output.kind)) {
          await tx
            .update(threads)
            .set({ baseOutputId: row.id, updatedAt: new Date() })
            .where(eq(threads.id, threadId));
        }
      }
      const rows: (typeof receipts.$inferInsert)[] = [];
      const placed = new Set<string>();
      input.outputs.forEach((output, i) => {
        const outputId = ids[i] ?? null;
        for (const r of input.receipts) {
          if (output.callIds && !output.callIds.includes(r.callId)) continue;
          placed.add(r.callId);
          rows.push(receiptRow(r, runId, threadId, outputId));
        }
      });
      // A call no output rests on is still kept, with the run that made it.
      for (const r of input.receipts) {
        if (!placed.has(r.callId)) rows.push(receiptRow(r, runId, threadId, null));
      }
      if (rows.length) await tx.insert(receipts).values(rows);
      return ids;
    });
  }
}

// Kinds the chat works on next: a plan, or a report a fix can be written from.
const BASES: NewOutput['kind'][] = ['build', 'scenario', 'audit', 'fix'];

function receiptRow(
  r: Receipt,
  runId: string,
  threadId: string,
  outputId: string | null,
): typeof receipts.$inferInsert {
  return {
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
  };
}
