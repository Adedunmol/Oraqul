import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ReactionKind, ReactionState } from '@oraqul/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, DB } from '../db/db.module.js';
import { outputs, reactions } from '../db/schema.js';

const withFindings = z.looseObject({ findings: z.array(z.looseObject({ id: z.string() })) });

/**
 * A person's rating of a plan (decision D41). It is stored with the findings the plan cited when it
 * was rated, so a "wrong" can be traced to the evidence behind it. Nothing here reaches Qloo or a
 * model, and the reaction never changes the plan.
 */
@Injectable()
export class ReactionsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Sets the caller's reaction, replacing an earlier one; `null` takes it back. */
  async set(outputId: string, userId: string, kind: ReactionKind | null): Promise<ReactionState> {
    if (kind === null) {
      await this.db
        .delete(reactions)
        .where(and(eq(reactions.outputId, outputId), eq(reactions.userId, userId)));
      return { kind: null };
    }
    const [output] = await this.db
      .select({ plan: outputs.plan, report: outputs.report })
      .from(outputs)
      .where(eq(outputs.id, outputId))
      .limit(1);
    if (!output) throw new NotFoundException('No such output');
    const findingIds = [
      ...new Set(
        [output.plan, output.report].flatMap(
          (doc) => withFindings.safeParse(doc).data?.findings.map((f) => f.id) ?? [],
        ),
      ),
    ];
    await this.db
      .insert(reactions)
      .values({ outputId, userId, kind, findingIds })
      .onConflictDoUpdate({
        target: [reactions.outputId, reactions.userId],
        set: { kind, findingIds, updatedAt: new Date() },
      });
    return { kind };
  }
}
