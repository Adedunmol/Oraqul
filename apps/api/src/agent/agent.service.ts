import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { demoFetch, QlooClient, type ToolContext } from '@oraqul/engine';
import { demoProjects } from '@oraqul/packs';
import { type Answer, type Category, type StartMode, type ThreadEvent } from '@oraqul/schema';
import type { Observable } from 'rxjs';
import type { Env } from '../config/env.js';
import { AnswerError, advance, newRunState, type RuntimeDeps } from './runtime.js';
import { ThreadRecord, ThreadStore } from './thread-store.js';
import type { Planner } from './types.js';

export const PLANNER = Symbol('PLANNER');

const CONSULT_MAX_STEPS = 4;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(ThreadStore) private readonly store: ThreadStore,
    @Inject(PLANNER) private readonly planner: Planner,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** Starts the run and returns once it first stops, usually on the router's confirm question. */
  async createThread(projectId: Category, mode: StartMode): Promise<{ threadId: string }> {
    const record = new ThreadRecord(
      randomUUID(),
      projectId,
      mode,
      newRunState(demoProjects[projectId], mode),
      this.toolContext(),
    );
    this.store.create(record);
    await this.run(record);
    return { threadId: record.id };
  }

  async answer(threadId: string, answer: Answer): Promise<void> {
    await this.run(this.record(threadId), answer);
  }

  thread(threadId: string) {
    const { id, projectId, mode, state, log } = this.record(threadId);
    return { id, projectId, mode, status: state.status, events: log };
  }

  events(threadId: string): Observable<ThreadEvent> {
    return this.record(threadId).events();
  }

  private record(threadId: string): ThreadRecord {
    const record = this.store.get(threadId);
    if (!record) throw new NotFoundException('No such thread');
    return record;
  }

  private async run(record: ThreadRecord, answer?: Answer): Promise<void> {
    if (record.state.status === 'active' && record.log.length > 0) {
      throw new ConflictException('The agent is still working');
    }
    const deps: RuntimeDeps = {
      planner: this.planner,
      tools: record.tools,
      maxSteps: this.config.get('AGENT_MAX_STEPS', { infer: true }),
      consultMaxSteps: CONSULT_MAX_STEPS,
      emit: (event) => record.emit(event),
    };
    try {
      await advance(record.state, deps, answer);
    } catch (err) {
      if (err instanceof AnswerError) throw new BadRequestException(err.message);
      this.logger.error(err);
      record.state.status = 'done';
      record.emit({ type: 'error', message: 'The agent hit an error and stopped.' });
      record.emit({ type: 'run.stopped', reason: 'error' });
    }
  }

  private toolContext(): ToolContext {
    const callBudget = this.config.get('QLOO_CALL_BUDGET', { infer: true });
    if (this.config.get('QLOO_MODE', { infer: true }) === 'demo') {
      const qloo = new QlooClient({
        baseUrl: 'https://demo.invalid',
        apiKey: 'demo',
        fetch: demoFetch,
        callBudget,
      });
      return { qloo, source: 'demo' };
    }
    const qloo = new QlooClient({
      baseUrl: this.config.get('QLOO_BASE_URL', { infer: true }),
      apiKey: this.config.get('QLOO_API_KEY', { infer: true }),
      timeoutMs: this.config.get('QLOO_TIMEOUT_MS', { infer: true }),
      callBudget,
    });
    return { qloo, source: 'qloo' };
  }
}
