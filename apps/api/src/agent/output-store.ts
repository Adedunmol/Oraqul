import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Receipt, ResultsComparison } from '@oraqul/schema';
import { eq } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { outcomes, outputs, projects, receipts, threads } from '../db/schema.js';
import type { NewOutput } from './category-agents.js';
import { VERSIONS, type Versions } from './versions.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Saves what a run made: its receipts always, and its outputs when it made a plan (spec §6). */
@Injectable()
export class OutputStore {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Optional() @Inject(VERSIONS) private readonly versions: Versions | null = null,
  ) {}

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
            refresh: output.refresh ?? null,
            headline: output.headline,
            moves: output.moves,
            confidence: output.confidence,
            inputs: output.inputs,
            versions: this.versions,
            dataAsOf: new Date(),
          })
          .returning({ id: outputs.id });
        if (!row) throw new Error('Output insert returned no row');
        ids.push(row.id);
        parentId = row.id;
        if (output.report?.results) {
          await this.recordOutcomes(tx, row.id, projectId, output.report.results);
        }
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

  /**
   * Keeps what the plan predicted next to what happened, one row per place and per age band, so the
   * bands and cut-offs can later be tested against outcomes (decision D40). Aggregates only.
   */
  private async recordOutcomes(
    tx: Tx,
    outputId: string,
    projectId: string,
    results: ResultsComparison,
  ): Promise<void> {
    const [project] = await tx
      .select({ category: projects.category })
      .from(projects)
      .where(eq(projects.id, projectId));
    const common = {
      outputId,
      projectId,
      category: project?.category ?? null,
      measure: results.measure,
      asOf: results.asOf,
      source: results.source,
    };
    const rows: (typeof outcomes.$inferInsert)[] = [
      ...results.rows.map((r) => ({
        ...common,
        kind: 'place' as const,
        label: r.place,
        plannedRank: r.plannedRank,
        actualRank: r.actualRank,
        actualShare: r.actualShare,
        predicted: r.lift,
        gap: r.gap,
      })),
      ...(results.ages ?? []).map((a) => ({
        ...common,
        kind: 'age' as const,
        label: a.band,
        plannedRank: null,
        actualRank: null,
        actualShare: a.actualShare,
        predicted: a.index,
        gap: null,
      })),
    ];
    if (rows.length) await tx.insert(outcomes).values(rows);
  }
}

// Kinds the chat works on next: a plan, or a report a fix can be written from.
export const BASES: NewOutput['kind'][] = ['build', 'scenario', 'audit', 'fix'];

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
