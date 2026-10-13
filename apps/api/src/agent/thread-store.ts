import type { ToolContext } from '@oraqul/engine';
import type { StartMode, ThreadEvent } from '@oraqul/schema';
import { Observable, ReplaySubject } from 'rxjs';
import type { RunState } from './runtime.js';

export class ThreadRecord {
  readonly log: ThreadEvent[] = [];
  private readonly subject = new ReplaySubject<ThreadEvent>();

  constructor(
    readonly id: string,
    readonly projectId: string,
    readonly mode: StartMode,
    readonly state: RunState,
    /** The run's own Qloo client, so the call budget and cache belong to this thread. */
    readonly tools: ToolContext,
  ) {}

  emit(event: ThreadEvent): void {
    this.log.push(event);
    this.subject.next(event);
  }

  /** Every event so far, then new ones as they happen. */
  events(): Observable<ThreadEvent> {
    return this.subject.asObservable();
  }
}

/** Threads live in memory until accounts and Postgres persistence land. A restart loses them. */
export abstract class ThreadStore {
  abstract create(record: ThreadRecord): void;
  abstract get(id: string): ThreadRecord | undefined;
}

export class InMemoryThreadStore extends ThreadStore {
  private readonly threads = new Map<string, ThreadRecord>();

  create(record: ThreadRecord): void {
    this.threads.set(record.id, record);
  }

  get(id: string): ThreadRecord | undefined {
    return this.threads.get(id);
  }
}
