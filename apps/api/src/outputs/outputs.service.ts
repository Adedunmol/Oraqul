import { Inject, Injectable } from '@nestjs/common';
import { briefSchema, type CompareResponse, type Output } from '@oraqul/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { outputs, projects, receipts, threads, users } from '../db/schema.js';
import { compareBriefs, comparePlans, presentOutput, storedPlan } from './present.js';

/** Saved outputs as the screens read them (spec §7). Writing them is `OutputStore`'s job. */
@Injectable()
export class OutputsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Every output of a project, in creation order. Empty for a draft. */
  async forProject(projectId: string): Promise<Output[]> {
    const [project] = await this.db
      .select({ category: projects.category })
      .from(projects)
      .where(eq(projects.id, projectId));
    const category = project?.category;
    if (!category) return [];
    const rows = await this.db
      .select({ output: outputs, by: users.name })
      .from(outputs)
      .innerJoin(threads, eq(threads.id, outputs.threadId))
      .innerJoin(users, eq(users.id, threads.createdBy))
      .where(eq(outputs.projectId, projectId))
      .orderBy(asc(outputs.createdAt));
    if (!rows.length) return [];
    const saved = await this.db
      .select()
      .from(receipts)
      .where(
        inArray(
          receipts.outputId,
          rows.map((r) => r.output.id),
        ),
      )
      .orderBy(asc(receipts.createdAt));
    const seen = new Map<string, number>();
    const briefs = new Map(
      rows.map(({ output }) => [output.id, briefSchema.safeParse(output.brief)]),
    );
    return rows.map(({ output, by }) => {
      const version = (seen.get(output.kind) ?? 0) + 1;
      seen.set(output.kind, version);
      const parent = output.parentId ? briefs.get(output.parentId) : undefined;
      const parentRow = output.parentId
        ? rows.find((r) => r.output.id === output.parentId)
        : undefined;
      return presentOutput({
        parentPlan: parentRow ? storedPlan(parentRow.output.plan) : null,
        row: output,
        receipts: saved.filter((r) => r.outputId === output.id),
        category,
        createdBy: by,
        version,
        parentBrief: parent?.success ? parent.data : null,
      });
    });
  }

  /** The plan a chat or project works on now: the newest plan-kind output. */
  currentPlanId(all: Output[]): string | null {
    const plans = all.filter((o) => o.kind === 'build' || o.kind === 'scenario');
    return plans.at(-1)?.id ?? null;
  }

  /** A saved plan and what it was built from, for a follow up on it. Null for an unknown id. */
  async plan(outputId: string): Promise<{ output: Output; inputs: unknown } | null> {
    const owner = await this.owner(outputId);
    if (!owner) return null;
    const [[row], all] = await Promise.all([
      this.db.select({ inputs: outputs.inputs }).from(outputs).where(eq(outputs.id, outputId)),
      this.forProject(owner.projectId),
    ]);
    const output = all.find((o) => o.id === outputId);
    return output ? { output, inputs: row?.inputs ?? null } : null;
  }

  /** Spec §7 `GET /projects/:id/compare`: the lines that differ between two of its outputs. */
  async compare(projectId: string, a: string, b: string): Promise<CompareResponse | null> {
    const all = await this.forProject(projectId);
    const from = all.find((o) => o.id === a);
    const to = all.find((o) => o.id === b);
    if (!from || !to) return null;
    const changes =
      from.plan && to.plan
        ? comparePlans(from.plan, to.plan)
        : compareBriefs(from.brief, to.brief, to.sections);
    return { a, b, changes };
  }

  /** The project and thread an output belongs to, or null for an unknown id. */
  async owner(outputId: string): Promise<{ projectId: string; threadId: string } | null> {
    const [row] = await this.db
      .select({ projectId: outputs.projectId, threadId: outputs.threadId })
      .from(outputs)
      .where(eq(outputs.id, outputId))
      .limit(1);
    return row ?? null;
  }
}
