import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CampaignAction,
  type CampaignSibling,
  type CampaignState,
  type CampaignTest,
  campaignGuideSchema,
  categorySchema,
  launchPlanSchema,
  testAngleSchema,
  type UpdateCampaignAction,
} from '@oraqul/schema';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { actionsFromPlan, testFor } from '../agent/launch/campaign.js';
import { type Database, DB } from '../db/db.module.js';
import { campaignActions, campaignTests, outputs, projects } from '../db/schema.js';

const NO_PLAN = 'This output is not a launch plan, so it has no campaign.';
const NO_CALENDAR =
  'This plan has no content calendar to turn into actions. The release date may have passed, or the plan answers one question only.';

const anglesSchema = z.tuple([testAngleSchema, testAngleSchema]);

/**
 * The campaign of a saved plan: its content calendar as actions the team edits and ticks off, and
 * an optional two-angle test for any of them. A set belongs to one plan version. Setting up a
 * version never touches another version's set, and nothing here is regenerated over an edit.
 */
@Injectable()
export class CampaignService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async state(outputId: string): Promise<CampaignState> {
    const found = await this.load(outputId);
    const actions = await this.actions(outputId);
    const others = await this.others(found.projectId, outputId);
    if (actions.length > 0) {
      return {
        outputId,
        status: 'set',
        reason: null,
        actions,
        tests: await this.tests(outputId),
        others,
      };
    }
    const reason = !found.plan ? NO_PLAN : found.plan.calendar.length === 0 ? NO_CALENDAR : null;
    return {
      outputId,
      status: reason ? 'none' : 'ready',
      reason,
      actions: [],
      tests: [],
      others,
    };
  }

  /** Makes the action set for this plan version. A second call returns the set that exists. */
  async setUp(outputId: string): Promise<CampaignState> {
    const found = await this.load(outputId);
    if (!found.plan) throw new ConflictException(NO_PLAN);
    if (found.plan.calendar.length === 0) throw new ConflictException(NO_CALENDAR);
    const drafts = actionsFromPlan({
      category: found.category,
      title: found.projectName,
      plan: found.plan,
    });
    await this.db.transaction(async (tx) => {
      // The lock keeps two clicks from making two sets: the second sees the first's rows.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${outputId}))`);
      const [existing] = await tx
        .select({ id: campaignActions.id })
        .from(campaignActions)
        .where(eq(campaignActions.outputId, outputId))
        .limit(1);
      if (existing) return;
      await tx
        .insert(campaignActions)
        .values(drafts.map((d) => ({ ...d, outputId, projectId: found.projectId })));
    });
    return this.state(outputId);
  }

  async update(
    outputId: string,
    actionId: string,
    patch: UpdateCampaignAction,
  ): Promise<CampaignAction> {
    const [row] = await this.db
      .select()
      .from(campaignActions)
      .where(and(eq(campaignActions.id, actionId), eq(campaignActions.outputId, outputId)))
      .limit(1);
    if (!row) throw new NotFoundException('No such action');
    // Ticking an action off is progress, not an edit of what the plan wrote.
    const rewrote = (['title', 'channel', 'startsOn', 'endsOn'] as const).some(
      (k) => patch[k] !== undefined && patch[k] !== row[k],
    );
    const [saved] = await this.db
      .update(campaignActions)
      .set({ ...patch, edited: row.edited || rewrote, updatedAt: new Date() })
      .where(eq(campaignActions.id, actionId))
      .returning();
    if (!saved) throw new NotFoundException('No such action');
    return toAction(saved);
  }

  /** Sets up the two-angle test for an action. One test an action: a second call returns it. */
  async addTest(outputId: string, actionId: string): Promise<CampaignTest> {
    const found = await this.load(outputId);
    if (!found.plan) throw new ConflictException(NO_PLAN);
    const [action] = await this.db
      .select()
      .from(campaignActions)
      .where(and(eq(campaignActions.id, actionId), eq(campaignActions.outputId, outputId)))
      .limit(1);
    if (!action) throw new NotFoundException('No such action');
    const territory = found.plan.territories.find((t) => t.name === action.territory);
    if (!territory) {
      throw new ConflictException(
        'A test needs an action that belongs to one of the plan’s places.',
      );
    }
    const draft = testFor({
      category: found.category,
      title: found.projectName,
      plan: found.plan,
      territory,
      channel: action.channel,
    });
    await this.db
      .insert(campaignTests)
      .values({
        actionId,
        angles: draft.angles,
        measure: draft.measure,
        conventions: draft.conventions,
      })
      .onConflictDoNothing({ target: campaignTests.actionId });
    const [test] = await this.db
      .select()
      .from(campaignTests)
      .where(eq(campaignTests.actionId, actionId))
      .limit(1);
    const parsed = test ? toTest(test) : null;
    if (!parsed) throw new NotFoundException('No such test');
    return parsed;
  }

  async removeTest(outputId: string, actionId: string): Promise<void> {
    const [action] = await this.db
      .select({ id: campaignActions.id })
      .from(campaignActions)
      .where(and(eq(campaignActions.id, actionId), eq(campaignActions.outputId, outputId)))
      .limit(1);
    if (!action) throw new NotFoundException('No such action');
    await this.db.delete(campaignTests).where(eq(campaignTests.actionId, actionId));
  }

  private async load(outputId: string) {
    const [row] = await this.db
      .select({
        projectId: outputs.projectId,
        plan: outputs.plan,
        kind: outputs.kind,
        category: projects.category,
        projectName: projects.name,
        title: outputs.title,
      })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(eq(outputs.id, outputId))
      .limit(1);
    if (!row) throw new NotFoundException('No such output');
    // A creative kit is a plan-shaped output with no calendar, so it never sets up a campaign.
    const plan = row.kind === 'creative' ? null : launchPlanSchema.safeParse(row.plan).data;
    return {
      projectId: row.projectId,
      projectName: row.projectName ?? row.title,
      category: categorySchema.parse(row.category),
      plan: plan ?? null,
    };
  }

  private async actions(outputId: string): Promise<CampaignAction[]> {
    const rows = await this.db
      .select()
      .from(campaignActions)
      .where(eq(campaignActions.outputId, outputId))
      .orderBy(asc(campaignActions.position));
    return rows.map(toAction);
  }

  private async tests(outputId: string): Promise<CampaignTest[]> {
    const rows = await this.db
      .select({ test: campaignTests })
      .from(campaignTests)
      .innerJoin(campaignActions, eq(campaignActions.id, campaignTests.actionId))
      .where(eq(campaignActions.outputId, outputId));
    return rows.flatMap(({ test }) => toTest(test) ?? []);
  }

  private async others(projectId: string, outputId: string): Promise<CampaignSibling[]> {
    const rows = await this.db
      .select({
        outputId: campaignActions.outputId,
        title: outputs.title,
        createdAt: outputs.createdAt,
        actions: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${campaignActions.status} = 'done')::int`,
      })
      .from(campaignActions)
      .innerJoin(outputs, eq(outputs.id, campaignActions.outputId))
      .where(and(eq(campaignActions.projectId, projectId), ne(campaignActions.outputId, outputId)))
      .groupBy(campaignActions.outputId, outputs.title, outputs.createdAt)
      .orderBy(asc(outputs.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
}

function toAction(row: typeof campaignActions.$inferSelect): CampaignAction {
  return {
    id: row.id,
    outputId: row.outputId,
    rowId: row.rowId,
    territory: row.territory,
    channel: row.channel,
    title: row.title,
    asset: row.asset,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    week: row.week,
    guide: campaignGuideSchema.safeParse(row.guide).data ?? null,
    findingIds: row.findingIds,
    status: row.status,
    note: row.note,
    edited: row.edited,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTest(row: typeof campaignTests.$inferSelect): CampaignTest | null {
  const angles = anglesSchema.safeParse(row.angles);
  if (!angles.success) return null;
  return {
    id: row.id,
    actionId: row.actionId,
    angles: angles.data,
    measure: row.measure,
    conventions: row.conventions,
    createdAt: row.createdAt.toISOString(),
  };
}
