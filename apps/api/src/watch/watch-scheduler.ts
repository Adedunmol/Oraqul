import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNull, notExists, sql } from 'drizzle-orm';
import { EMAIL_SENDER, type EmailSender } from '../auth/email/email-sender.js';
import { watchDigestEmail } from '../auth/email/templates.js';
import type { Env } from '../config/env.js';
import { type Database, DB } from '../db/db.module.js';
import {
  memberships,
  outputs,
  projects,
  users,
  watchEvents,
  watches,
  watchMutes,
} from '../db/schema.js';
import { SEVERITY_RANK } from './checks.js';
import { cadenceMs } from './watch.service.js';
import { WatchChecker } from './watch-checker.js';

export const TICK_MS = 5 * 60 * 1000;
/** A claimed watch not finished by then is taken as lost to a crash and picked up again. */
export const LOCK_MS = 10 * 60 * 1000;
const PER_TICK = 5;
const RETRY_MS = 60 * 60 * 1000;

/**
 * Runs due watches inside this process. State lives in Postgres, not memory: each watch has a due
 * time, a tick claims due rows under a row lock, and a restart only delays a check. Every missed
 * check runs once at boot, and the next one is set from now, so a long outage never queues a burst.
 * This holds because the API runs as one instance (architecture.md); a second instance would still
 * not run a watch twice, because of the lock.
 */
@Injectable()
export class WatchScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WatchScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(WatchChecker) private readonly checker: WatchChecker,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    // Specs and the e2e suite boot the app; they run ticks themselves.
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Returns how many watches were checked. A tick that overlaps a running one does nothing. */
  async tick(now: Date = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const claimed = await this.claim(now);
      for (const id of claimed) await this.process(id, now);
      return claimed.length;
    } catch (err) {
      this.logger.error(err);
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Marks due rows locked in the same statement that finds them, so two ticks never take one. */
  private async claim(now: Date): Promise<string[]> {
    const until = new Date(now.getTime() + LOCK_MS);
    const result = await this.db.execute(sql`
      update watches set locked_until = ${until.toISOString()}
      where id in (
        select id from watches
        where status = 'active'
          and next_check_at <= ${now.toISOString()}
          and (locked_until is null or locked_until < ${now.toISOString()})
        order by next_check_at
        limit ${PER_TICK}
        for update skip locked
      )
      returning id`);
    return (result as unknown as { rows: { id: string }[] }).rows.map((r) => r.id);
  }

  private async process(id: string, now: Date): Promise<void> {
    const [watch] = await this.db.select().from(watches).where(eq(watches.id, id));
    if (!watch) return;
    try {
      const outcome = await this.checker.run(watch.outputId, now);
      const inserted = outcome.events.length
        ? await this.db
            .insert(watchEvents)
            .values(
              outcome.events.map((e) => ({
                watchId: id,
                outputId: watch.outputId,
                type: e.type,
                severity: e.severity,
                dedupeKey: e.dedupeKey,
                detail: { title: e.title, reason: e.reason, evidence: e.evidence },
              })),
            )
            .onConflictDoNothing()
            .returning()
        : [];
      await this.db
        .update(watches)
        .set({
          lastCheckedAt: now,
          nextCheckAt: new Date(now.getTime() + cadenceMs(watch.cadence)),
          lockedUntil: null,
          lastNotes: outcome.notes,
          lastResultHash: outcome.events
            .map((e) => e.dedupeKey)
            .sort()
            .join('|'),
          updatedAt: now,
        })
        .where(eq(watches.id, id));
      const worth = inserted.filter(
        (e) => SEVERITY_RANK[e.severity] >= SEVERITY_RANK[watch.minSeverity],
      );
      if (worth.length) await this.digest(watch.outputId, id, worth);
    } catch (err) {
      this.logger.error(err);
      // The check is delayed, not lost: it comes due again in an hour.
      await this.db
        .update(watches)
        .set({ nextCheckAt: new Date(now.getTime() + RETRY_MS), lockedUntil: null })
        .where(eq(watches.id, id));
    }
  }

  /** One email to each owner and editor who has not muted this watch. Never any Qloo data. */
  private async digest(
    outputId: string,
    watchId: string,
    events: (typeof watchEvents.$inferSelect)[],
  ): Promise<void> {
    const [row] = await this.db
      .select({ teamId: projects.teamId, name: projects.name, title: outputs.title })
      .from(outputs)
      .innerJoin(projects, eq(projects.id, outputs.projectId))
      .where(eq(outputs.id, outputId));
    if (!row) return;
    const people = await this.db
      .select({ email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.teamId, row.teamId),
          inArray(memberships.role, ['owner', 'editor']),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(watchMutes)
              .where(and(eq(watchMutes.watchId, watchId), eq(watchMutes.userId, users.id))),
          ),
        ),
      );
    const link = `${this.config.get('WEB_ORIGIN', { infer: true })}/outputs/${outputId}?tab=watch`;
    const content = events.map((e) => {
      const d = e.detail as {
        title: string;
        reason: string;
        evidence: { url: string; title: string; retrievedAt: string }[];
      };
      return { severity: e.severity, title: d.title, reason: d.reason, evidence: d.evidence };
    });
    for (const person of people) {
      try {
        await this.email.send(
          watchDigestEmail(person.email, { project: row.name ?? row.title, events: content, link }),
        );
      } catch (err) {
        this.logger.warn(`Watch digest to one recipient failed: ${err}`);
      }
    }
    await this.db
      .update(watchEvents)
      .set({ emailedAt: new Date() })
      .where(
        and(
          inArray(
            watchEvents.id,
            events.map((e) => e.id),
          ),
          isNull(watchEvents.emailedAt),
        ),
      );
  }
}
