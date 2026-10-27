import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Draft,
  type FundingItem,
  type FundingState,
  fundDataSchema,
  launchPlanSchema,
  type ProjectFacts,
  projectFactsSchema,
  type Role,
  sponsorDataSchema,
  type UpdateFundingItem,
} from '@oraqul/schema';
import { and, asc, eq } from 'drizzle-orm';
import { type Database, DB } from '../db/db.module.js';
import { fundingItems, outputs, projects } from '../db/schema.js';
import { TeamRulesService } from '../team-rules/team-rules.service.js';
import { buildDraft } from './draft.js';
import { FUNDING_RESEARCHER, type FundingResearcher } from './fund-research.js';

type Row = typeof fundingItems.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
const WORKING = ['found', 'qualified'];
const AFTER_SENDING = ['sent_by_you', 'replied'];

/**
 * A plan's sponsors and funds and the pipeline each moves through. Oraqul finds and drafts; a
 * person approves, opens the text in their own app and sends it, then confirms it was sent. No
 * route here sends anything, and `sent_by_you` can be reached only through that confirmation.
 */
@Injectable()
export class FundingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(TeamRulesService) private readonly rules: TeamRulesService,
    @Inject(FUNDING_RESEARCHER) private readonly researcher: FundingResearcher,
  ) {}

  private view(row: Row): FundingItem {
    const sponsor = row.kind === 'sponsor' ? sponsorDataSchema.safeParse(row.data) : null;
    const fund = row.kind === 'fund' ? fundDataSchema.safeParse(row.data) : null;
    return {
      id: row.id,
      planId: row.planId,
      kind: row.kind,
      name: row.name,
      territory: row.territory || null,
      status: row.status,
      nextFollowUpOn: row.nextFollowUpOn,
      note: row.note,
      sponsor: sponsor?.success ? sponsor.data : null,
      fund: fund?.success ? fund.data : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async plan(outputId: string) {
    const [row] = await this.db
      .select({ plan: outputs.plan, projectId: outputs.projectId, name: projects.name })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(eq(outputs.id, outputId));
    if (!row) throw new NotFoundException('No such output');
    const plan = launchPlanSchema.safeParse(row.plan);
    return {
      plan: plan.success ? plan.data : null,
      projectId: row.projectId,
      name: row.name ?? 'Our launch',
    };
  }

  async projectOf(outputId: string): Promise<{ projectId: string }> {
    const { projectId } = await this.plan(outputId);
    return { projectId };
  }

  async facts(projectId: string): Promise<ProjectFacts> {
    const [row] = await this.db
      .select({ facts: projects.facts })
      .from(projects)
      .where(eq(projects.id, projectId));
    const parsed = projectFactsSchema.safeParse(row?.facts ?? {});
    return parsed.success ? parsed.data : { stage: null, nationality: null };
  }

  async setFacts(projectId: string, facts: ProjectFacts): Promise<ProjectFacts> {
    await this.db.update(projects).set({ facts }).where(eq(projects.id, projectId));
    return this.facts(projectId);
  }

  async state(outputId: string): Promise<FundingState> {
    const { plan, projectId } = await this.plan(outputId);
    const facts = await this.facts(projectId);
    const base = { planId: outputId, facts, canSearch: this.researcher.enabled };
    if (!plan || plan.scope !== 'full') {
      return {
        ...base,
        status: 'none',
        reason: 'Funding and sponsors are found for a full launch plan.',
        items: [],
      };
    }
    const rows = await this.db
      .select()
      .from(fundingItems)
      .where(eq(fundingItems.planId, outputId))
      .orderBy(asc(fundingItems.kind), asc(fundingItems.createdAt));
    return {
      ...base,
      status: rows.length ? 'set' : 'ready',
      reason: null,
      items: rows.map((r) => this.view(r)),
    };
  }

  private async item(outputId: string, itemId: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(fundingItems)
      .where(and(eq(fundingItems.id, itemId), eq(fundingItems.planId, outputId)));
    if (!row) throw new NotFoundException('No such item');
    return row;
  }

  /** A person sets found, qualified, replied, won or lost; approved and sent by you have their own steps. */
  async update(outputId: string, itemId: string, patch: UpdateFundingItem): Promise<FundingItem> {
    const row = await this.item(outputId, itemId);
    if (patch.status) {
      const to = patch.status;
      const ok =
        (WORKING.includes(to) && (WORKING.includes(row.status) || row.status === 'drafted')) ||
        (['replied', 'won', 'lost'].includes(to) && AFTER_SENDING.includes(row.status)) ||
        (to === 'lost' && row.status !== 'won');
      if (!ok) {
        throw new ConflictException(
          to === 'replied' || to === 'won'
            ? 'Only something you have confirmed sending can have a reply.'
            : 'That status cannot be set from here.',
        );
      }
    }
    const [updated] = await this.db
      .update(fundingItems)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.nextFollowUpOn !== undefined ? { nextFollowUpOn: patch.nextFollowUpOn } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(fundingItems.id, itemId))
      .returning();
    return this.view(updated ?? row);
  }

  private async drafted(outputId: string, row: Row): Promise<Draft> {
    const { plan, name } = await this.plan(outputId);
    if (!plan) throw new BadRequestException('This output is not a launch plan.');
    return buildDraft(plan, name, this.view(row));
  }

  /** Writes the pitch or the application pack from the plan. Nothing is sent. */
  async draft(outputId: string, itemId: string): Promise<{ item: FundingItem; draft: Draft }> {
    const row = await this.item(outputId, itemId);
    const draft = await this.drafted(outputId, row);
    if (!WORKING.includes(row.status)) return { item: this.view(row), draft };
    const [updated] = await this.db
      .update(fundingItems)
      .set({ status: 'drafted', updatedAt: new Date() })
      .where(eq(fundingItems.id, itemId))
      .returning();
    return { item: this.view(updated ?? row), draft };
  }

  /**
   * The person approves the draft. It returns the text for them to open in their own app, and the
   * team's approval rule decides who may. Nothing is sent, and the contact they type is never stored.
   */
  async handoff(
    outputId: string,
    itemId: string,
    who: { teamId: string; projectId: string; role: Role },
  ): Promise<{ item: FundingItem; draft: Draft }> {
    const row = await this.item(outputId, itemId);
    if (row.status !== 'drafted' && row.status !== 'approved') {
      throw new ConflictException('Draft it first, then approve it.');
    }
    const rules = await this.rules.forRun(who.teamId, who.projectId);
    if (rules.approvalRole === 'owner' && who.role !== 'owner') {
      throw new ForbiddenException(
        'Your team’s defaults need an owner to approve anything that leaves Oraqul.',
      );
    }
    const draft = await this.drafted(outputId, row);
    const [updated] = await this.db
      .update(fundingItems)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(fundingItems.id, itemId))
      .returning();
    return { item: this.view(updated ?? row), draft };
  }

  /** The person says they sent it. This is the only way an item reaches `sent_by_you`. */
  async confirmSent(
    outputId: string,
    itemId: string,
    now: Date = new Date(),
  ): Promise<FundingItem> {
    const row = await this.item(outputId, itemId);
    if (row.status !== 'approved')
      throw new ConflictException('Approve the draft before saying you sent it.');
    const followUp =
      row.nextFollowUpOn ?? new Date(now.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
    const [updated] = await this.db
      .update(fundingItems)
      .set({ status: 'sent_by_you', nextFollowUpOn: followUp, updatedAt: now })
      .where(eq(fundingItems.id, itemId))
      .returning();
    return this.view(updated ?? row);
  }
}
