import { Inject, Injectable } from '@nestjs/common';
import type { MemoryItem } from '@oraqul/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { type Database, DB } from '../../db/db.module.js';
import { memoryItems } from '../../db/schema.js';
import { type MemoryOp, type Note } from './memory-writer.js';

type Row = typeof memoryItems.$inferSelect;

const toItem = (row: Row): MemoryItem => ({
  id: row.id,
  kind: row.kind,
  text: row.text,
  updatedAt: row.updatedAt.toISOString(),
});

/** What a project remembers (spec §3.7). Memory is context for a chat, never evidence. */
@Injectable()
export class MemoryStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(projectId: string): Promise<MemoryItem[]> {
    const rows = await this.db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.projectId, projectId))
      .orderBy(asc(memoryItems.createdAt));
    return rows.map(toItem);
  }

  /** The notes the memory writer may change: key points and decisions, not plan pointers. */
  async notes(projectId: string): Promise<Note[]> {
    const rows = await this.db
      .select()
      .from(memoryItems)
      .where(
        and(eq(memoryItems.projectId, projectId), inArray(memoryItems.kind, ['point', 'decision'])),
      )
      .orderBy(asc(memoryItems.createdAt));
    return rows.flatMap((r) =>
      r.kind === 'plan' ? [] : [{ id: r.id, kind: r.kind, text: r.text }],
    );
  }

  /** The lines a chat reads, plans first. Stored text only; nothing here was measured. */
  async lines(projectId: string): Promise<string[]> {
    const items = await this.list(projectId);
    return [
      ...items.filter((i) => i.kind === 'plan'),
      ...items.filter((i) => i.kind !== 'plan'),
    ].map((i) => (i.kind === 'plan' ? `Plan: ${i.text}` : i.text));
  }

  async apply(
    projectId: string,
    ops: MemoryOp[],
    source: { threadId: string; outputId: string | null },
  ): Promise<void> {
    if (ops.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const op of ops) {
        if (op.op === 'add') {
          await tx.insert(memoryItems).values({
            projectId,
            kind: op.kind,
            text: op.text,
            sourceThreadId: source.threadId,
            sourceOutputId: source.outputId,
          });
        } else if (op.op === 'update') {
          await tx
            .update(memoryItems)
            .set({ text: op.text, updatedAt: new Date() })
            .where(and(eq(memoryItems.id, op.id), eq(memoryItems.projectId, projectId)));
        } else {
          await tx
            .delete(memoryItems)
            .where(and(eq(memoryItems.id, op.id), eq(memoryItems.projectId, projectId)));
        }
      }
    });
  }

  /**
   * Points a project's memory at the plan a chat just made. A newer plan from the same chat
   * replaces the earlier one; a plan from another chat sits beside it, so two alternatives are
   * both remembered.
   */
  async rememberPlan(
    projectId: string,
    threadId: string,
    output: { id: string; text: string },
  ): Promise<void> {
    const [existing] = await this.db
      .select({ id: memoryItems.id })
      .from(memoryItems)
      .where(
        and(
          eq(memoryItems.projectId, projectId),
          eq(memoryItems.kind, 'plan'),
          eq(memoryItems.sourceThreadId, threadId),
        ),
      )
      .limit(1);
    if (existing) {
      await this.db
        .update(memoryItems)
        .set({ text: output.text, sourceOutputId: output.id, updatedAt: new Date() })
        .where(eq(memoryItems.id, existing.id));
      return;
    }
    await this.db.insert(memoryItems).values({
      projectId,
      kind: 'plan',
      text: output.text,
      sourceThreadId: threadId,
      sourceOutputId: output.id,
    });
  }

  /** The person's own edit. Plan pointers are kept by code and cannot be rewritten. */
  async edit(projectId: string, itemId: string, text: string): Promise<MemoryItem | null> {
    const [row] = await this.db
      .update(memoryItems)
      .set({ text, updatedAt: new Date() })
      .where(
        and(
          eq(memoryItems.id, itemId),
          eq(memoryItems.projectId, projectId),
          inArray(memoryItems.kind, ['point', 'decision']),
        ),
      )
      .returning();
    return row ? toItem(row) : null;
  }

  async remove(projectId: string, itemId: string): Promise<boolean> {
    const rows = await this.db
      .delete(memoryItems)
      .where(and(eq(memoryItems.id, itemId), eq(memoryItems.projectId, projectId)))
      .returning({ id: memoryItems.id });
    return rows.length > 0;
  }
}
