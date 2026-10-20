import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Category,
  CompareResponse,
  NeedsYouItem,
  OutputDetail,
  Overview,
  Project,
  ProjectDetail,
  RecentThread,
  Role,
  StartMode,
  Thread,
  ThreadDetail,
  ThreadSummary,
  WorkspaceProject,
} from '@oraqul/schema';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { RunService } from '../agent/run.service.js';
import { ThreadStore, toItems } from '../agent/thread-store.js';
import { UNNAMED_THREAD } from '../agent/titler.js';
import { type Database, DB } from '../db/db.module.js';
import {
  memberships,
  messages,
  outputs,
  pins,
  projects,
  runs,
  shareLinks,
  threadReads,
  threads,
  users,
} from '../db/schema.js';
import { OutputsService } from '../outputs/outputs.service.js';

/** A person keeps three pins at most; pinning a fourth drops the oldest (spec §7). */
export const MAX_PINS = 3;
const RECENT_THREADS = 4;

const STATUS_BY_MODE: Record<StartMode, string> = {
  build: 'Planning',
  audit: 'Audit',
  fix: 'Fix',
};

const commaList = z.array(z.string());

type ProjectRow = typeof projects.$inferSelect;
type ThreadRow = typeof threads.$inferSelect;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ThreadStore) private readonly store: ThreadStore,
    @Inject(RunService) private readonly runs: RunService,
    @Inject(OutputsService) private readonly outputs: OutputsService,
  ) {}

  /** The team's projects, newest first. Drafts the router is still reading are left out. */
  async list(teamId: string, category: Category | undefined): Promise<Project[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.teamId, teamId),
          ne(projects.status, 'intake'),
          category ? eq(projects.category, category) : undefined,
        ),
      )
      .orderBy(desc(projects.updatedAt));
    return rows.flatMap((row) => {
      const project = toProject(row);
      return project ? [project] : [];
    });
  }

  async detail(projectId: string, userId: string, role: Role): Promise<ProjectDetail> {
    const project = await this.project(projectId);
    const rows = await this.db
      .select({ thread: threads, by: users.name })
      .from(threads)
      .innerJoin(users, eq(users.id, threads.createdBy))
      .where(eq(threads.projectId, projectId))
      .orderBy(desc(threads.createdAt));
    const [summaries, all] = await Promise.all([
      this.summaries(rows, userId),
      this.outputs.forProject(projectId),
    ]);
    return {
      project: toWorkspaceProject(project),
      threads: summaries,
      outputs: all,
      currentPlanId: this.outputs.currentPlanId(all),
      myRole: role,
    };
  }

  async threadDetail(threadId: string): Promise<ThreadDetail> {
    const [row] = await this.db
      .select({ thread: threads, by: users.name, project: projects })
      .from(threads)
      .innerJoin(users, eq(users.id, threads.createdBy))
      .innerJoin(projects, eq(projects.id, threads.projectId))
      .where(eq(threads.id, threadId))
      .limit(1);
    if (!row) throw new NotFoundException('No such thread');
    const busy = this.runs.isBusy(threadId);
    const [stored, all] = await Promise.all([
      this.store.rows(threadId),
      this.outputs.forProject(row.project.id),
    ]);
    return {
      thread: toThread(row.thread, row.by),
      project: toWorkspaceProject(row.project),
      items: toItems(stored, busy),
      outputs: all.filter((o) => o.threadId === threadId),
      projectOutputs: all,
      busy,
      lastSeq: stored.at(-1)?.seq ?? 0,
    };
  }

  /** `GET /projects/:projectId/compare`: the lines that differ between two of its outputs. */
  async compare(projectId: string, a: string, b: string): Promise<CompareResponse> {
    const result = await this.outputs.compare(projectId, a, b);
    if (!result) throw new NotFoundException('Both outputs must belong to this project');
    return result;
  }

  /** `GET /outputs/:outputId`: the output, its project and chat, and what it was built on. */
  async outputDetail(outputId: string): Promise<OutputDetail> {
    const owner = await this.outputs.owner(outputId);
    if (!owner) throw new NotFoundException('No such output');
    const [row] = await this.db
      .select({ project: projects, thread: threads, by: users.name })
      .from(threads)
      .innerJoin(projects, eq(projects.id, threads.projectId))
      .innerJoin(users, eq(users.id, threads.createdBy))
      .where(eq(threads.id, owner.threadId))
      .limit(1);
    const project = row ? toProject(row.project) : null;
    const all = await this.outputs.forProject(owner.projectId);
    const output = all.find((o) => o.id === outputId);
    if (!row || !project || !output) throw new NotFoundException('No such output');
    const [link] = await this.db
      .select({ token: shareLinks.token, enabled: shareLinks.enabled })
      .from(shareLinks)
      .where(eq(shareLinks.outputId, outputId))
      .limit(1);
    return {
      output,
      project,
      thread: toThread(row.thread, row.by),
      builtOn: all.find((o) => o.id === output.parentId) ?? null,
      share: link ?? null,
    };
  }

  /** New chat (spec §9). A draft has only its first chat until the router has read it. */
  async createThread(projectId: string, userId: string): Promise<{ threadId: string }> {
    const project = await this.project(projectId);
    if (project.status === 'intake') {
      throw new ConflictException('Finish setting up this project in its first chat');
    }
    const [thread] = await this.db
      .insert(threads)
      .values({ projectId, name: UNNAMED_THREAD, createdBy: userId })
      .returning({ id: threads.id });
    if (!thread) throw new Error('Thread insert returned no row');
    return { threadId: thread.id };
  }

  async delete(projectId: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, projectId));
  }

  /** Marks everything stored in the thread so far as read by this person. */
  async markRead(threadId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .select({ seq: sql<number>`coalesce(max(${messages.seq}), 0)` })
      .from(messages)
      .where(eq(messages.threadId, threadId));
    const readSeq = Number(row?.seq ?? 0);
    await this.db
      .insert(threadReads)
      .values({ userId, threadId, readSeq })
      .onConflictDoUpdate({
        target: [threadReads.userId, threadReads.threadId],
        set: { readSeq },
      });
  }

  /**
   * Spec §9 overview: Needs you (a question waiting, a run going, something new), then other
   * threads to pick up. "Out with no results" joins once projects record that they launched.
   */
  async overview(teamId: string, userId: string): Promise<Overview> {
    const rows = await this.db
      .select({ thread: threads, by: users.name, project: projects })
      .from(threads)
      .innerJoin(projects, eq(projects.id, threads.projectId))
      .innerJoin(users, eq(users.id, threads.createdBy))
      .where(and(eq(projects.teamId, teamId), ne(projects.status, 'intake')))
      .orderBy(desc(threads.updatedAt));
    if (!rows.length) return { needsYou: [], threads: [] };

    const threadIds = rows.map((r) => r.thread.id);
    const [waiting, unread, counts] = await Promise.all([
      this.openQuestions(threadIds),
      this.unreadThreads(threadIds, userId),
      this.outputCounts(threadIds),
    ]);

    const needsYou: NeedsYouItem[] = [];
    const recent: RecentThread[] = [];
    for (const row of rows) {
      const project = toProject(row.project);
      if (!project) continue;
      const thread = toThread(row.thread, row.by);
      const busy = this.runs.isBusy(thread.id);
      const prompt = waiting.get(thread.id);
      if (busy) needsYou.push({ reason: 'working', thread, project });
      else if (prompt !== undefined) needsYou.push({ reason: 'answer', thread, project, prompt });
      else if (unread.has(thread.id) && (counts.get(thread.id) ?? 0) > 0) {
        needsYou.push({ reason: 'ready', thread, project });
      } else {
        recent.push({
          thread,
          project,
          outputCount: counts.get(thread.id) ?? 0,
          unread: unread.has(thread.id),
          busy,
        });
      }
    }
    const order = { answer: 0, results: 1, ready: 2, working: 3 } as const;
    needsYou.sort((a, b) => order[a.reason] - order[b.reason]);
    return { needsYou, threads: recent.slice(0, RECENT_THREADS) };
  }

  /** The person's pinned projects they can still see, newest pin first. */
  async pins(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ projectId: pins.projectId })
      .from(pins)
      .innerJoin(projects, eq(projects.id, pins.projectId))
      .innerJoin(
        memberships,
        and(eq(memberships.teamId, projects.teamId), eq(memberships.userId, userId)),
      )
      .where(and(eq(pins.userId, userId), ne(projects.status, 'intake')))
      .orderBy(desc(pins.createdAt));
    return rows.map((r) => r.projectId);
  }

  async pin(userId: string, projectId: string): Promise<string[]> {
    const project = await this.project(projectId);
    if (project.status === 'intake') throw new ConflictException('This project is not set up yet');
    await this.db.transaction(async (tx) => {
      await tx.insert(pins).values({ userId, projectId }).onConflictDoNothing();
      const kept = await tx
        .select({ id: pins.id })
        .from(pins)
        .where(eq(pins.userId, userId))
        .orderBy(desc(pins.createdAt), desc(pins.id));
      const dropped = kept.slice(MAX_PINS).map((p) => p.id);
      if (dropped.length) await tx.delete(pins).where(inArray(pins.id, dropped));
    });
    return this.pins(userId);
  }

  async unpin(userId: string, projectId: string): Promise<string[]> {
    await this.db.delete(pins).where(and(eq(pins.userId, userId), eq(pins.projectId, projectId)));
    return this.pins(userId);
  }

  private async project(projectId: string): Promise<ProjectRow> {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!row) throw new NotFoundException('No such project');
    return row;
  }

  private async summaries(
    rows: { thread: ThreadRow; by: string }[],
    userId: string,
  ): Promise<ThreadSummary[]> {
    const ids = rows.map((r) => r.thread.id);
    const [unread, counts] = await Promise.all([
      this.unreadThreads(ids, userId),
      this.outputCounts(ids),
    ]);
    return rows.map(({ thread, by }) => ({
      thread: toThread(thread, by),
      outputCount: counts.get(thread.id) ?? 0,
      unread: unread.has(thread.id),
    }));
  }

  private async openQuestions(threadIds: string[]): Promise<Map<string, string>> {
    if (!threadIds.length) return new Map();
    const rows = await this.db
      .selectDistinctOn([runs.threadId], {
        threadId: runs.threadId,
        status: runs.status,
      })
      .from(runs)
      .where(inArray(runs.threadId, threadIds))
      .orderBy(runs.threadId, desc(runs.createdAt));
    const waiting = rows.filter((r) => r.status === 'waiting').map((r) => r.threadId);
    if (!waiting.length) return new Map();
    const questions = await this.db
      .selectDistinctOn([messages.threadId], {
        threadId: messages.threadId,
        prompt: sql<string>`${messages.body}->'question'->>'prompt'`,
      })
      .from(messages)
      .where(and(inArray(messages.threadId, waiting), eq(messages.role, 'question')))
      .orderBy(messages.threadId, desc(messages.seq));
    return new Map(questions.map((q) => [q.threadId, q.prompt]));
  }

  // Threads with an agent item this person has not seen. Their own messages never count.
  private async unreadThreads(threadIds: string[], userId: string): Promise<Set<string>> {
    if (!threadIds.length) return new Set();
    const rows = await this.db
      .select({ threadId: messages.threadId })
      .from(messages)
      .leftJoin(
        threadReads,
        and(eq(threadReads.threadId, messages.threadId), eq(threadReads.userId, userId)),
      )
      .where(
        and(
          inArray(messages.threadId, threadIds),
          ne(messages.role, 'user'),
          sql`${messages.seq} > coalesce(${threadReads.readSeq}, 0)`,
        ),
      )
      .groupBy(messages.threadId);
    return new Set(rows.map((r) => r.threadId));
  }

  private async outputCounts(threadIds: string[]): Promise<Map<string, number>> {
    if (!threadIds.length) return new Map();
    const rows = await this.db
      .select({ threadId: outputs.threadId, count: sql<number>`count(*)` })
      .from(outputs)
      .where(inArray(outputs.threadId, threadIds))
      .groupBy(outputs.threadId);
    return new Map(rows.map((r) => [r.threadId, Number(r.count)]));
  }
}

/** A set-up project as the lists show it. Null for a draft, which has no name or category yet. */
export function toProject(row: ProjectRow): Project | null {
  const { name, category } = row;
  if (name === null || category === null) return null;
  return { ...inputs(row), name, category };
}

function toWorkspaceProject(row: ProjectRow): WorkspaceProject {
  return { ...inputs(row), name: row.name, category: row.category, mode: row.mode };
}

function inputs(row: ProjectRow) {
  const comps = commaList.safeParse(row.comps);
  return {
    id: row.id,
    kind: row.kind ?? '',
    genre: row.genre ?? '',
    places: row.places,
    window: row.launchWindow ?? '',
    lead: row.lead ?? '',
    comps: comps.success ? comps.data : [],
    status: row.status === 'active' && row.mode ? STATUS_BY_MODE[row.mode] : row.status,
    updatedAt: row.updatedAt.toISOString(),
    qlooMatch: null,
    extra: {},
  };
}

function toThread(row: ThreadRow, by: string): Thread {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    createdBy: by,
    createdAt: row.createdAt.toISOString(),
    baseOutputId: row.baseOutputId,
    fromOutputId: row.fromOutputId,
    fresh: row.fresh,
  };
}
