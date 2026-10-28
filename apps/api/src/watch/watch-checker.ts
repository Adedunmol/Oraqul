import { Inject, Injectable } from '@nestjs/common';
import { WATCH_RULES } from '@oraqul/packs';
import { launchPlanSchema } from '@oraqul/schema';
import { and, eq, gt } from 'drizzle-orm';
import { releaseOf } from '../agent/launch/campaign.js';
import { type Database, DB } from '../db/db.module.js';
import { campaignActions, fundingItems, outputs, projects } from '../db/schema.js';
import {
  type DraftEvent,
  milestoneEvents,
  type PipelineRow,
  paceEvent,
  pipelineEvents,
  rivalEvents,
  staleEvent,
} from './checks.js';
import { PaceService } from './pace.service.js';
import { RIVAL_FINDER, type RivalFinder } from './rival-dates.js';

export interface CheckOutcome {
  events: DraftEvent[];
  /** What the check could not do. Shown beside the events, so a quiet check is not read as all clear. */
  notes: string[];
}

/**
 * One check of one watched plan. Everything is decided in code; the only model step is reading web
 * results for rival dates, and each date it returns was found on the page it cites. No Qloo call is
 * made here, so a watch never spends the monthly budget on its own.
 */
@Injectable()
export class WatchChecker {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(RIVAL_FINDER) private readonly rivals: RivalFinder,
    @Inject(PaceService) private readonly pace: PaceService,
  ) {}

  async run(outputId: string, now: Date = new Date()): Promise<CheckOutcome> {
    const today = now.toISOString().slice(0, 10);
    const [row] = await this.db
      .select({ output: outputs, project: projects })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(eq(outputs.id, outputId))
      .limit(1);
    const plan = launchPlanSchema.safeParse(row?.output.plan);
    if (!row || !plan.success) return { events: [], notes: ['This output is not a launch plan.'] };

    const events: DraftEvent[] = [];
    const notes: string[] = [];
    const release = releaseOf(plan.data.calendar);

    const actions = await this.db
      .select()
      .from(campaignActions)
      .where(eq(campaignActions.outputId, outputId));
    if (actions.length === 0) {
      notes.push('The campaign is not set up, so no milestones were checked.');
    } else {
      events.push(...milestoneEvents(actions, today));
    }

    const pipeline = await this.db
      .select()
      .from(fundingItems)
      .where(eq(fundingItems.planId, outputId));
    events.push(
      ...pipelineEvents(
        pipeline.map((r): PipelineRow => {
          const data = r.data as {
            deadline?: string | null;
            sourceUrl?: string;
            sourceTitle?: string;
            retrievedAt?: string;
          };
          return {
            id: r.id,
            kind: r.kind,
            name: r.name,
            status: r.status,
            nextFollowUpOn: r.nextFollowUpOn,
            deadline: r.kind === 'fund' ? (data.deadline ?? null) : null,
            source:
              r.kind === 'fund' && data.sourceUrl
                ? {
                    url: data.sourceUrl,
                    title: data.sourceTitle ?? data.sourceUrl,
                    retrievedAt: data.retrievedAt ?? today,
                  }
                : null,
          };
        }),
        today,
      ),
    );

    const [newer] = await this.db
      .select({ id: outputs.id })
      .from(outputs)
      .where(
        and(
          eq(outputs.projectId, row.project.id),
          eq(outputs.kind, 'refresh'),
          gt(outputs.createdAt, row.output.createdAt),
        ),
      )
      .limit(1);
    const stale = staleEvent(
      row.output.createdAt.toISOString().slice(0, 10),
      Boolean(newer),
      today,
    );
    if (stale) events.push(stale);

    const paced = await this.pace.state(outputId, today);
    if (paced.available) {
      const behind = paceEvent(paced.result);
      if (behind) events.push(behind);
    }

    if (!release) {
      notes.push('The plan has no release date, so rival dates were not checked.');
    } else if (!this.rivals.enabled) {
      notes.push('Rival dates were not checked: web search is not set up.');
    } else {
      try {
        const named = (row.output.inputs as { rivals?: { title: string }[] } | null)?.rivals ?? [];
        const found = await this.rivals.find({
          category: row.project.category ?? 'film',
          kind: row.project.kind,
          genre: row.project.genre,
          cities: row.project.places,
          release,
          today,
          spanDays: WATCH_RULES.rivalSearchDays.value,
        });
        events.push(
          ...rivalEvents(found.rivals, release, [
            ...named.map((r) => r.title),
            row.project.name ?? '',
            row.output.title,
          ]),
        );
      } catch {
        notes.push('Rival dates could not be checked this time: the web search failed.');
      }
    }
    return { events, notes };
  }
}
