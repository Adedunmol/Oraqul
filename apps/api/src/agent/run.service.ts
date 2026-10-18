import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { packs } from '@oraqul/packs';
import type {
  Attachment,
  CreateProjectResult,
  createProjectInputSchema,
  postMessageSchema,
  StopReason,
  ThreadEvent,
} from '@oraqul/schema';
import { and, desc, eq } from 'drizzle-orm';
import { Observable, Subject } from 'rxjs';
import type { z } from 'zod';
import { type Database, DB } from '../db/db.module.js';
import { projects, runs, threads } from '../db/schema.js';
import {
  type AgentRun,
  CATEGORY_AGENTS,
  type CategoryAgents,
  type Handoff,
  type Reply,
  ReplyError,
  type Said,
  said,
  saidSchema,
} from './category-agents.js';
import { GATE, type Gate, type GatePending, gateDecide, gateStateSchema } from './gate/gate.js';
import { OutputStore } from './output-store.js';
import { OFF_TOPIC_REPLY, readingLine } from './router/copy.js';
import type { Reader } from './router/reader.js';
import {
  answerLabel,
  newRouterState,
  RouterAnswerError,
  type RouterState,
  type RouterTurn,
  routerStateSchema,
  routeTurn,
} from './router/router.js';
import { ThreadStore } from './thread-store.js';
import { THREAD_TITLER, type Titler, UNNAMED_THREAD } from './titler.js';

export const ROUTER_READER = Symbol('ROUTER_READER');

/** An event on a thread's live stream. `seq` is set when the event is stored in the transcript. */
export interface LiveEvent {
  seq?: number;
  event: ThreadEvent;
}

type CreateProject = z.output<typeof createProjectInputSchema>;
type PostMessage = z.output<typeof postMessageSchema>;

// What the gate judges a message against, and what the agent reads of the chat before it.
const RECENT_LINES = 8;

// Projects started before the first message was kept on the project have none.
const NO_INPUTS: Said = { text: '', files: [] };

/**
 * Runs the agent in the background and streams what it does (spec §8). The request that starts
 * a run returns at once; the web follows along on `GET /threads/:id/events`. Runs live in this
 * process, so the API runs as one process (agent.md).
 */
@Injectable()
export class RunService implements OnModuleInit {
  private readonly logger = new Logger(RunService.name);
  private readonly buses = new Map<string, Subject<LiveEvent>>();
  private readonly active = new Set<string>();

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ThreadStore) private readonly store: ThreadStore,
    @Inject(ROUTER_READER) private readonly reader: Reader,
    @Inject(CATEGORY_AGENTS) private readonly agents: CategoryAgents,
    @Inject(THREAD_TITLER) private readonly titler: Titler,
    @Inject(GATE) private readonly gate: Gate,
    @Inject(OutputStore) private readonly outputs: OutputStore,
  ) {}

  /** A run that was going when the process stopped will never finish, so say so. */
  async onModuleInit(): Promise<void> {
    await this.db
      .update(runs)
      .set({ status: 'error', stopReason: 'error', finishedAt: new Date() })
      .where(eq(runs.status, 'running'));
  }

  isBusy(threadId: string): boolean {
    return this.active.has(threadId);
  }

  /** Spec §9.2: the first message makes a draft project and its first chat, then the router reads it. */
  async createProject(
    teamId: string,
    userId: string,
    input: CreateProject,
  ): Promise<CreateProjectResult> {
    const first = said(input.text, input.attachments);
    const { projectId, threadId } = await this.db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({ teamId, createdBy: userId, status: 'intake', inputs: first })
        .returning({ id: projects.id });
      if (!project) throw new Error('Project insert returned no row');
      const [thread] = await tx
        .insert(threads)
        .values({ projectId: project.id, name: UNNAMED_THREAD, createdBy: userId })
        .returning({ id: threads.id });
      if (!thread) throw new Error('Thread insert returned no row');
      return { projectId: project.id, threadId: thread.id };
    });
    await this.store.appendUser(threadId, input.text, input.attachments);
    const state = newRouterState({ category: input.category, mode: input.mode });
    const turn: RouterTurn = { kind: 'message', text: forRouter(first) };
    this.launch(threadId, async () => {
      await this.nameThread(threadId, input.text, input.attachments);
      await this.routerSegment(threadId, projectId, state, turn);
    });
    return { projectId, threadId };
  }

  /** A message or a card answer. Starts the next run segment and returns before it finishes. */
  async post(threadId: string, body: PostMessage): Promise<void> {
    if (this.active.has(threadId)) throw new ConflictException('The agent is still working');
    const project = await this.projectOf(threadId);

    if (project.status === 'intake') {
      const state = await this.routerState(threadId);
      let turn: RouterTurn;
      if (body.kind === 'answer') {
        try {
          await this.store.answerOpenQuestion(threadId, answerLabel(state, body.answer));
        } catch (err) {
          if (err instanceof RouterAnswerError) throw new BadRequestException(err.message);
          throw err;
        }
        turn = { kind: 'answer', answer: body.answer };
      } else {
        if (!body.text.trim() && body.attachments.length === 0) {
          throw new BadRequestException('Type a message or attach a file');
        }
        await this.store.appendUser(threadId, body.text, body.attachments);
        if (state.pending) await this.store.answerOpenQuestion(threadId, body.text);
        turn = { kind: 'message', text: forRouter(said(body.text, body.attachments)) };
      }
      this.launch(threadId, () => this.routerSegment(threadId, project.id, state, turn));
      return;
    }

    const { category, mode, name, inputs, planId } = project;
    if (!category || !mode || !name) throw new Error('An active project has no category or mode');
    const handoff = async (message: Said): Promise<Handoff> => ({
      category,
      mode,
      title: name,
      inputs,
      message,
      recent: await this.store.recentLines(threadId, RECENT_LINES),
      planId,
    });

    // A card the agent asked: the reply resumes that run, and the gate does not judge it.
    const waiting = await this.agentWaiting(threadId, category);
    if (waiting) {
      const reply: Reply =
        body.kind === 'answer' ? body.answer : { kind: 'typed', text: body.text };
      let label: string;
      try {
        label = this.agents[category].replyLabel(waiting.state, reply);
      } catch (err) {
        if (err instanceof ReplyError) throw new BadRequestException(err.message);
        throw err;
      }
      if (body.kind === 'text') await this.store.appendUser(threadId, body.text, body.attachments);
      await this.store.answerOpenQuestion(threadId, label);
      this.launch(threadId, async () =>
        this.agentSegment(threadId, project.id, await handoff(said(label, [])), {
          state: waiting.state,
          reply,
        }),
      );
      return;
    }

    const pending = await this.gatePending(threadId);

    if (body.kind === 'answer' && !pending) {
      throw new BadRequestException('No question is waiting');
    }
    if (body.kind === 'answer' && pending?.question.id !== body.answer.questionId) {
      throw new BadRequestException('That is not the question asked');
    }
    if (body.kind === 'answer' && body.answer.kind === 'options') {
      // A suggestion we made is on topic by construction, so it goes straight to the agent.
      const [optionId] = body.answer.optionIds;
      const label = optionId ? pending?.picks[optionId] : undefined;
      if (!label || body.answer.optionIds.length !== 1) {
        throw new BadRequestException('That option is not on the card');
      }
      await this.store.answerOpenQuestion(threadId, label);
      this.launch(threadId, async () =>
        this.agentSegment(threadId, project.id, await handoff(said(label, []))),
      );
      return;
    }

    const text =
      body.kind === 'answer' ? (body.answer.kind === 'text' ? body.answer.text : '') : body.text;
    const attachments = body.kind === 'answer' ? [] : body.attachments;
    if (!text.trim() && attachments.length === 0) {
      throw new BadRequestException('Type a message or attach a file');
    }
    await this.store.appendUser(threadId, text, attachments);
    if (pending) await this.store.answerOpenQuestion(threadId, text);
    const unnamed = project.threadName === UNNAMED_THREAD;
    this.launch(threadId, async () => {
      if (unnamed) await this.nameThread(threadId, text, attachments);
      const ready = await handoff(said(text, attachments));
      if (await this.gateSegment(threadId, ready)) {
        await this.agentSegment(threadId, project.id, ready);
      }
    });
  }

  /**
   * Stored events after `afterSeq`, then live ones, then the current status. Subscribes before
   * reading the store, so an event that lands while the stored ones are read is not lost.
   */
  events(threadId: string, afterSeq: number): Observable<LiveEvent> {
    return new Observable<LiveEvent>((subscriber) => {
      let replaying = true;
      let last = afterSeq;
      const held: LiveEvent[] = [];
      const pass = (e: LiveEvent) => {
        if (e.seq !== undefined) {
          if (e.seq <= last) return;
          last = e.seq;
        }
        subscriber.next(e);
      };
      const live = this.bus(threadId).subscribe((e) => (replaying ? held.push(e) : pass(e)));
      (async () => {
        for (const stored of await this.store.eventsAfter(threadId, afterSeq)) pass(stored);
        replaying = false;
        for (const e of held.splice(0)) pass(e);
        if (!this.active.has(threadId)) {
          subscriber.next({
            event: { type: 'run.stopped', reason: await this.lastReason(threadId) },
          });
        }
      })().catch((err: unknown) => subscriber.error(err));
      return () => live.unsubscribe();
    });
  }

  private async routerSegment(
    threadId: string,
    projectId: string,
    state: RouterState,
    turn: RouterTurn,
  ): Promise<void> {
    const runId = await this.newRun(threadId, 'router', null, state);
    const steps: string[] = [];
    const trace = (text: string, step: number, of: number) => {
      steps.push(text);
      return this.emit(threadId, { type: 'trace.step', agent: 'router', step, of, text });
    };
    try {
      await trace('Reading your message', 1, 2);
      const { decision, tokens } = await routeTurn(state, turn, this.reader);
      switch (decision.kind) {
        case 'off_topic':
          await this.emit(threadId, { type: 'message', body: OFF_TOPIC_REPLY, claims: [] });
          return await this.stop(threadId, runId, 'finished', { state, steps, tokens });
        case 'ask':
          await this.emit(threadId, {
            type: 'question',
            agent: 'router',
            ...decision.pending.question,
          });
          return await this.stop(threadId, runId, 'waiting', { state, steps, tokens });
        case 'routed': {
          const { title, category, mode } = decision;
          await this.db
            .update(projects)
            .set({ name: title, category, mode, status: 'active', updatedAt: new Date() })
            .where(eq(projects.id, projectId));
          const { threadName, inputs } = await this.projectOf(threadId);
          await this.emit(threadId, {
            type: 'project.updated',
            projectId,
            name: title,
            category,
            mode,
            threadName,
          });
          await trace(`Handing this to the ${packs[category].title} agent`, 2, 2);
          await this.emit(threadId, {
            type: 'message',
            body: readingLine(mode, title, packs[category].title),
            claims: [],
          });
          await this.finishRun(runId, 'finished', { state, steps, tokens, job: mode });
          return await this.agentSegment(threadId, projectId, {
            category,
            mode,
            title,
            inputs,
            message: inputs,
            recent: [],
            planId: null,
          });
        }
      }
    } catch (err) {
      await this.fail(threadId, runId, err, { state, steps, tokens: 0 });
    }
  }

  /**
   * Judges a message sent to an active project (backend/agent.md). Returns true when the agent
   * should run. An off topic message gets the fixed refusal and an unclear one gets a card of
   * close readings, and in both the run stops here.
   */
  private async gateSegment(threadId: string, handoff: Handoff): Promise<boolean> {
    const runId = await this.newRun(threadId, 'gate', null, null);
    try {
      const { category, mode, title, recent } = handoff;
      const { reading, tokens } = await this.gate.check({
        project: { category, mode, title },
        recent,
      });
      const decision = gateDecide(reading, `gate.${runId}`);
      const record = { state: null, steps: [], tokens };
      switch (decision.kind) {
        case 'pass':
          await this.finishRun(runId, 'finished', record);
          return true;
        case 'refuse':
          await this.emit(threadId, { type: 'message', body: OFF_TOPIC_REPLY, claims: [] });
          await this.stop(threadId, runId, 'finished', record);
          return false;
        case 'ask':
          await this.emit(threadId, {
            type: 'question',
            agent: 'gate',
            ...decision.pending.question,
          });
          await this.stop(threadId, runId, 'waiting', {
            ...record,
            state: { pending: decision.pending },
          });
          return false;
      }
    } catch (err) {
      await this.fail(threadId, runId, err, { state: null, steps: [], tokens: 0 });
      return false;
    }
  }

  /** The gate card waiting for an answer, if the thread's last run left one open. */
  private async gatePending(threadId: string): Promise<GatePending | null> {
    const [run] = await this.db
      .select({ agent: runs.agent, status: runs.status, state: runs.state })
      .from(runs)
      .where(eq(runs.threadId, threadId))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    if (run?.agent !== 'gate' || run.status !== 'waiting' || !run.state) return null;
    return gateStateSchema.parse(run.state).pending;
  }

  private async agentSegment(
    threadId: string,
    projectId: string,
    handoff: Handoff,
    resume?: { state: unknown; reply: Reply },
  ): Promise<void> {
    const runId = await this.newRun(threadId, handoff.category, handoff.mode, null);
    const steps: string[] = [];
    // The agent emits without waiting on the store, so events are chained to keep their order.
    let stored: Promise<void> = Promise.resolve();
    try {
      const run: AgentRun = await this.agents[handoff.category].run(
        handoff,
        (event) => {
          if (event.type === 'trace.step') steps.push(event.text);
          stored = stored.then(() => this.emit(threadId, event));
        },
        resume,
      );
      await stored;
      const outputId = await this.outputs.save({
        threadId,
        projectId,
        runId,
        output: run.output,
        receipts: run.receipts,
      });
      if (outputId) await this.emit(threadId, { type: 'output.created', outputId });
      await this.stop(threadId, runId, run.reason, {
        state: run.state,
        steps,
        tokens: run.tokens,
        qlooCalls: run.qlooCalls,
      });
    } catch (err) {
      await stored.catch(() => undefined);
      await this.fail(threadId, runId, err, { state: null, steps, tokens: 0 });
    }
  }

  /** The agent run waiting on a card, if the thread's last run left one open. */
  private async agentWaiting(
    threadId: string,
    category: string,
  ): Promise<{ state: unknown } | null> {
    const [run] = await this.db
      .select({ agent: runs.agent, status: runs.status, state: runs.state })
      .from(runs)
      .where(eq(runs.threadId, threadId))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    if (run?.agent !== category || run.status !== 'waiting' || !run.state) return null;
    return { state: run.state };
  }

  /** Names a chat from its first message. Only an unnamed chat is renamed, so this runs once. */
  private async nameThread(threadId: string, text: string, attachments: Attachment[]) {
    try {
      const name = await this.titler.title({ text, files: attachments.map((a) => a.name) });
      await this.db
        .update(threads)
        .set({ name })
        .where(and(eq(threads.id, threadId), eq(threads.name, UNNAMED_THREAD)));
    } catch (err) {
      // A chat left as "New chat" is better than a run that never starts.
      this.logger.error(err);
    }
  }

  private launch(threadId: string, work: () => Promise<void>): void {
    this.active.add(threadId);
    void work()
      .catch((err: unknown) => this.logger.error(err))
      .finally(() => this.active.delete(threadId));
  }

  private async emit(threadId: string, event: ThreadEvent): Promise<void> {
    const seq = await this.store.appendEvent(threadId, event);
    this.bus(threadId).next(seq === null ? { event } : { seq, event });
  }

  private async stop(
    threadId: string,
    runId: string,
    reason: StopReason,
    record: RunRecord,
  ): Promise<void> {
    await this.finishRun(runId, reason, record);
    this.bus(threadId).next({ event: { type: 'run.stopped', reason } });
  }

  private async fail(threadId: string, runId: string, err: unknown, record: RunRecord) {
    this.logger.error(err);
    await this.emit(threadId, { type: 'error', message: 'The agent hit an error and stopped.' });
    await this.stop(threadId, runId, 'error', record);
  }

  private async newRun(
    threadId: string,
    agent: string,
    job: Handoff['mode'] | null,
    state: object | null,
  ): Promise<string> {
    const [run] = await this.db
      .insert(runs)
      .values({ threadId, agent, job, state, status: 'running' })
      .returning({ id: runs.id });
    if (!run) throw new Error('Run insert returned no row');
    return run.id;
  }

  private async finishRun(runId: string, reason: StopReason, record: RunRecord): Promise<void> {
    const status = reason === 'waiting' ? 'waiting' : reason === 'error' ? 'error' : 'done';
    await this.db
      .update(runs)
      .set({
        status,
        stopReason: reason,
        finishedAt: new Date(),
        steps: record.steps,
        tokens: record.tokens,
        ...(record.qlooCalls ? { qlooCalls: record.qlooCalls } : {}),
        ...(record.state ? { state: record.state } : {}),
        ...(record.job ? { job: record.job } : {}),
      })
      .where(eq(runs.id, runId));
  }

  private async lastReason(threadId: string): Promise<StopReason> {
    const [run] = await this.db
      .select({ stopReason: runs.stopReason })
      .from(runs)
      .where(eq(runs.threadId, threadId))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    return run?.stopReason ?? 'finished';
  }

  /** The router's state from its last run on this thread, checked on the way out of the database. */
  private async routerState(threadId: string): Promise<RouterState> {
    const [run] = await this.db
      .select({ state: runs.state })
      .from(runs)
      .where(and(eq(runs.threadId, threadId), eq(runs.agent, 'router')))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    return run?.state ? routerStateSchema.parse(run.state) : newRouterState({});
  }

  private async projectOf(threadId: string) {
    const [row] = await this.db
      .select({
        id: projects.id,
        status: projects.status,
        name: projects.name,
        category: projects.category,
        mode: projects.mode,
        inputs: projects.inputs,
        threadName: threads.name,
        planId: threads.baseOutputId,
      })
      .from(threads)
      .innerJoin(projects, eq(projects.id, threads.projectId))
      .where(eq(threads.id, threadId))
      .limit(1);
    if (!row) throw new NotFoundException('No such thread');
    return { ...row, inputs: saidSchema.nullable().parse(row.inputs) ?? NO_INPUTS };
  }

  private bus(threadId: string): Subject<LiveEvent> {
    let bus = this.buses.get(threadId);
    if (!bus) {
      bus = new Subject<LiveEvent>();
      this.buses.set(threadId, bus);
    }
    return bus;
  }
}

interface RunRecord {
  state: object | null;
  steps: string[];
  tokens: number;
  qlooCalls?: number;
  job?: Handoff['mode'];
}

/** The words the router reads: the message, then the text of any small text file. */
function forRouter({ text, files }: Said): string {
  const parts = files.map((f) =>
    f.text ? `[File: ${f.name}]\n${f.text}` : `[Attached file: ${f.name}]`,
  );
  return [text, ...parts].filter(Boolean).join('\n\n');
}
