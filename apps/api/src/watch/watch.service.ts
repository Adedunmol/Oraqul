import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  launchPlanSchema,
  type UpdateWatch,
  type WatchEvent,
  type WatchEvidence,
  type WatchState,
  watchEvidenceSchema,
} from '@oraqul/schema';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { RunService } from '../agent/run.service.js';
import { type Database, DB } from '../db/db.module.js';
import { outputs, watchEvents, watches, watchMutes, watchReads } from '../db/schema.js';
import { PaceService } from './pace.service.js';
import { watchUnreadByProject } from './unread.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const cadenceMs = (cadence: 'daily' | 'weekly') =>
  cadence === 'daily' ? DAY_MS : 7 * DAY_MS;

const detailSchema = z.object({
  title: z.string(),
  reason: z.string(),
  evidence: z.array(watchEvidenceSchema).default([]),
});

/** What approving each event type starts: a normal run on the plan's chat, as the person who approved. */
const ACTION_MESSAGE: Partial<Record<WatchEvent['type'], string>> = {
  plan_stale: 'Check what has changed since this plan was made.',
  pace_behind: 'Rescue this launch.',
};

@Injectable()
export class WatchService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PaceService) private readonly pace: PaceService,
    @Inject(RunService) private readonly runs: RunService,
  ) {}

  private async outputRow(outputId: string) {
    const [row] = await this.db
      .select({
        id: outputs.id,
        plan: outputs.plan,
        threadId: outputs.threadId,
        projectId: outputs.projectId,
      })
      .from(outputs)
      .where(eq(outputs.id, outputId))
      .limit(1);
    if (!row) throw new NotFoundException('No such output');
    return row;
  }

  async state(outputId: string, userId: string): Promise<WatchState> {
    const row = await this.outputRow(outputId);
    const watchable = launchPlanSchema.safeParse(row.plan).success;
    const pace = await this.pace.state(outputId);
    const [watch] = await this.db.select().from(watches).where(eq(watches.outputId, outputId));
    if (!watch) {
      return {
        outputId,
        status: 'off',
        cadence: 'daily',
        minSeverity: 'watch',
        lastCheckedAt: null,
        nextCheckAt: null,
        notes: [],
        muted: false,
        unread: 0,
        events: [],
        pace,
        watchable,
      };
    }
    const [read] = await this.db
      .select({ seenThrough: watchReads.seenThrough })
      .from(watchReads)
      .where(and(eq(watchReads.userId, userId), eq(watchReads.watchId, watch.id)));
    const [mute] = await this.db
      .select({ id: watchMutes.id })
      .from(watchMutes)
      .where(and(eq(watchMutes.userId, userId), eq(watchMutes.watchId, watch.id)));
    const rows = await this.db
      .select()
      .from(watchEvents)
      .where(eq(watchEvents.watchId, watch.id))
      .orderBy(desc(watchEvents.createdAt))
      .limit(50);
    const seenThrough = read?.seenThrough ?? new Date(0);
    const events = rows.flatMap((e): WatchEvent[] => {
      const detail = detailSchema.safeParse(e.detail);
      if (!detail.success) return [];
      return [
        {
          id: e.id,
          type: e.type,
          severity: e.severity,
          title: detail.data.title,
          reason: detail.data.reason,
          evidence: detail.data.evidence,
          status: e.status,
          actionOutputId: e.actionOutputId,
          createdAt: e.createdAt.toISOString(),
          seen: e.createdAt <= seenThrough,
        },
      ];
    });
    return {
      outputId,
      status: watch.status,
      cadence: watch.cadence,
      minSeverity: watch.minSeverity,
      lastCheckedAt: watch.lastCheckedAt?.toISOString() ?? null,
      nextCheckAt: watch.nextCheckAt.toISOString(),
      notes: watch.lastNotes,
      muted: Boolean(mute),
      unread: events.filter((e) => !e.seen).length,
      events,
      pace,
      watchable,
    };
  }

  /** Turns the watch on, off or changes it. A new watch is first checked at the next tick. */
  async update(
    outputId: string,
    ctx: { userId: string; teamId: string },
    body: UpdateWatch,
  ): Promise<WatchState> {
    const row = await this.outputRow(outputId);
    if (!launchPlanSchema.safeParse(row.plan).success) {
      throw new BadRequestException('Only a launch plan can be watched.');
    }
    const [existing] = await this.db.select().from(watches).where(eq(watches.outputId, outputId));
    if (existing) {
      await this.db
        .update(watches)
        .set({
          ...(body.status ? { status: body.status } : {}),
          ...(body.cadence ? { cadence: body.cadence } : {}),
          ...(body.minSeverity ? { minSeverity: body.minSeverity } : {}),
          // Turning a paused watch back on checks it at the next tick rather than at an old time.
          ...(body.status === 'active' && existing.status === 'paused'
            ? { nextCheckAt: new Date() }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(watches.id, existing.id));
    } else {
      await this.db.insert(watches).values({
        outputId,
        projectId: row.projectId,
        teamId: ctx.teamId,
        status: body.status ?? 'active',
        cadence: body.cadence ?? 'daily',
        minSeverity: body.minSeverity ?? 'watch',
        nextCheckAt: new Date(),
        createdBy: ctx.userId,
      });
    }
    return this.state(outputId, ctx.userId);
  }

  private async watchOf(outputId: string) {
    const [watch] = await this.db.select().from(watches).where(eq(watches.outputId, outputId));
    if (!watch) throw new NotFoundException('This plan is not being watched');
    return watch;
  }

  async mute(outputId: string, userId: string, muted: boolean): Promise<WatchState> {
    const watch = await this.watchOf(outputId);
    if (muted) {
      await this.db.insert(watchMutes).values({ userId, watchId: watch.id }).onConflictDoNothing();
    } else {
      await this.db
        .delete(watchMutes)
        .where(and(eq(watchMutes.userId, userId), eq(watchMutes.watchId, watch.id)));
    }
    return this.state(outputId, userId);
  }

  async markRead(outputId: string, userId: string): Promise<void> {
    const [watch] = await this.db.select().from(watches).where(eq(watches.outputId, outputId));
    if (!watch) return;
    await this.db
      .insert(watchReads)
      .values({ userId, watchId: watch.id, seenThrough: new Date() })
      .onConflictDoUpdate({
        target: [watchReads.userId, watchReads.watchId],
        set: { seenThrough: new Date() },
      });
  }

  private async eventOf(outputId: string, eventId: string) {
    const [event] = await this.db
      .select()
      .from(watchEvents)
      .where(and(eq(watchEvents.id, eventId), eq(watchEvents.outputId, outputId)));
    if (!event) throw new NotFoundException('No such event');
    if (event.status !== 'open') throw new ConflictException('That event was already answered');
    return event;
  }

  async dismiss(outputId: string, eventId: string, userId: string): Promise<WatchState> {
    await this.eventOf(outputId, eventId);
    await this.db
      .update(watchEvents)
      .set({ status: 'dismissed' })
      .where(eq(watchEvents.id, eventId));
    return this.state(outputId, userId);
  }

  /**
   * Approving an event is the only way a watch starts work. It posts the plan's ordinary request to
   * its chat as the person who approved, so the run counts against their cap and the Qloo budget
   * like any other, and the plan itself is never touched.
   */
  async approve(outputId: string, eventId: string, userId: string): Promise<WatchState> {
    const event = await this.eventOf(outputId, eventId);
    const message = ACTION_MESSAGE[event.type];
    if (!message)
      throw new BadRequestException('This event has nothing to run. Dismiss it instead.');
    const row = await this.outputRow(outputId);
    await this.runs.post(
      row.threadId,
      { kind: 'text', text: message, attachments: [] },
      { userId, via: 'watch' },
    );
    await this.db
      .update(watchEvents)
      .set({ status: 'approved' })
      .where(eq(watchEvents.id, eventId));
    return this.state(outputId, userId);
  }

  unreadByProject(projectIds: string[], userId: string) {
    return watchUnreadByProject(this.db, projectIds, userId);
  }
}

export type { WatchEvidence };
