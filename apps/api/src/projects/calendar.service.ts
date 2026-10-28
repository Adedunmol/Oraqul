import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { launchPlanSchema } from '@oraqul/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { releaseOf } from '../agent/launch/campaign.js';
import { type Database, DB } from '../db/db.module.js';
import { calendarFeeds, campaignActions, fundingItems, outputs, projects } from '../db/schema.js';
import { buildIcs, type IcsEvent, isIsoDay } from '../outputs/ics.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

const rivalsSchema = z.array(z.object({ title: z.string(), date: z.string() }));

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface FeedState {
  active: boolean;
}

/**
 * A plan's dates as a calendar: the release, the campaign's dated actions, when the plan's signal
 * is read, the rivals the team named and the date a date check chose. Titles and dates only, since
 * a subscribed calendar app holds nothing but a token. Code writes it; nothing asks Qloo or a model.
 */
@Injectable()
export class CalendarService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async forOutput(outputId: string): Promise<{ name: string; ics: string }> {
    const [row] = await this.db
      .select({ output: outputs, name: projects.name })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(eq(outputs.id, outputId))
      .limit(1);
    if (!row) throw new NotFoundException('No such output');
    const name = row.name ?? row.output.title;
    return { name, ics: buildIcs({ name, events: await this.events(row.output.id, name) }) };
  }

  /** The project's newest plan, so a subscribed feed follows a revision. */
  async forProject(projectId: string): Promise<{ name: string; ics: string }> {
    const [latest] = await this.db
      .select({ id: outputs.id })
      .from(outputs)
      .where(
        and(eq(outputs.projectId, projectId), inArray(outputs.kind, ['build', 'fix', 'scenario'])),
      )
      .orderBy(desc(outputs.createdAt))
      .limit(1);
    if (!latest) throw new NotFoundException('No plan yet');
    return this.forOutput(latest.id);
  }

  private async events(outputId: string, name: string): Promise<IcsEvent[]> {
    const [row] = await this.db.select().from(outputs).where(eq(outputs.id, outputId)).limit(1);
    const plan = launchPlanSchema.safeParse(row?.plan);
    if (!row || !plan.success) return [];
    const events: IcsEvent[] = [];
    const release = releaseOf(plan.data.calendar);

    if (release)
      events.push({ uid: `release-${outputId}`, date: release, title: `Release: ${name}` });

    const actions = await this.db
      .select()
      .from(campaignActions)
      .where(eq(campaignActions.outputId, outputId))
      .orderBy(campaignActions.position);
    if (actions.length > 0) {
      for (const a of actions) {
        if (a.status === 'done' || !isIsoDay(a.startsOn)) continue;
        const where = [a.territory, a.channel].filter(Boolean).join(', ');
        events.push({
          uid: `action-${a.id}`,
          date: a.startsOn,
          endDate: a.endsOn ?? undefined,
          title: where ? `${a.title} (${where})` : a.title,
        });
      }
    } else {
      for (const r of plan.data.calendar) {
        if (!isIsoDay(r.from)) continue;
        const where = [r.territory, r.channel].filter(Boolean).join(', ');
        events.push({
          uid: `row-${outputId}-${r.id}`,
          date: r.from,
          endDate: r.to ?? undefined,
          title: where ? `${r.post} (${where})` : r.post,
        });
      }
    }

    const signal = plan.data.signal;
    if (release && signal) {
      for (const offset of signal.checkpoints) {
        events.push({
          uid: `read-${outputId}-${offset}`,
          date: addDays(release, offset),
          title: `Read: ${signal.primary}`,
        });
      }
    }

    const rivals = rivalsSchema.safeParse((row.inputs as { rivals?: unknown } | null)?.rivals);
    if (rivals.success) {
      for (const r of rivals.data) {
        events.push({
          uid: `rival-${outputId}-${r.title}`,
          date: r.date,
          title: `Rival opens: ${r.title}`,
        });
      }
    }

    // Fund deadlines and the follow ups the team set on its pipeline: titles and dates, as the rest.
    const pipeline = await this.db
      .select()
      .from(fundingItems)
      .where(eq(fundingItems.planId, outputId));
    for (const item of pipeline) {
      if (item.status === 'lost' || item.status === 'won') continue;
      const deadline = (item.data as { deadline?: unknown }).deadline;
      if (item.kind === 'fund' && typeof deadline === 'string' && isIsoDay(deadline)) {
        events.push({
          uid: `fund-${item.id}`,
          date: deadline,
          title: `Fund deadline: ${item.name}`,
        });
      }
      if (isIsoDay(item.nextFollowUpOn)) {
        events.push({
          uid: `follow-${item.id}`,
          date: item.nextFollowUpOn,
          title: `Follow up: ${item.name}`,
        });
      }
    }

    const [check] = await this.db
      .select({ brief: outputs.brief })
      .from(outputs)
      .where(and(eq(outputs.projectId, row.projectId), eq(outputs.kind, 'date')))
      .orderBy(desc(outputs.createdAt))
      .limit(1);
    const chosen = (check?.brief as { chosenDate?: unknown } | undefined)?.chosenDate;
    if (typeof chosen === 'string' && isIsoDay(chosen)) {
      events.push({
        uid: `date-check-${row.projectId}`,
        date: chosen,
        title: 'Date chosen in the date check',
      });
    }
    return events;
  }

  async feedState(projectId: string): Promise<FeedState> {
    const [row] = await this.db
      .select({ id: calendarFeeds.id })
      .from(calendarFeeds)
      .where(and(eq(calendarFeeds.projectId, projectId), isNull(calendarFeeds.revokedAt)))
      .limit(1);
    return { active: Boolean(row) };
  }

  /** Makes the project's feed and revokes the one before. The token is returned once and never stored. */
  async createFeed(projectId: string, userId: string): Promise<{ token: string }> {
    const token = randomBytes(32).toString('base64url');
    await this.db.transaction(async (tx) => {
      await tx
        .update(calendarFeeds)
        .set({ revokedAt: new Date() })
        .where(and(eq(calendarFeeds.projectId, projectId), isNull(calendarFeeds.revokedAt)));
      await tx
        .insert(calendarFeeds)
        .values({ projectId, tokenHash: hash(token), createdBy: userId });
    });
    return { token };
  }

  async revokeFeed(projectId: string): Promise<void> {
    await this.db
      .update(calendarFeeds)
      .set({ revokedAt: new Date() })
      .where(and(eq(calendarFeeds.projectId, projectId), isNull(calendarFeeds.revokedAt)));
  }

  /** The calendar behind a token. A wrong token and a revoked one answer the same 404. */
  async byToken(token: string): Promise<{ name: string; ics: string }> {
    const bare = token.replace(/\.ics$/i, '');
    const [feed] = await this.db
      .select({ projectId: calendarFeeds.projectId })
      .from(calendarFeeds)
      .where(and(eq(calendarFeeds.tokenHash, hash(bare)), isNull(calendarFeeds.revokedAt)))
      .limit(1);
    if (!feed) throw new NotFoundException('No such calendar');
    return this.forProject(feed.projectId);
  }
}
