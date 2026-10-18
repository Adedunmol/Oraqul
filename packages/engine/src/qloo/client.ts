import { randomUUID } from 'node:crypto';
import type { Receipt } from '@oraqul/schema';
import type { z } from 'zod';
import { type QlooParams, serializeParams } from './params';

/** What went to Qloo and what came back. Tools turn this into a receipt (`toReceipt`). */
export interface QlooCall {
  callId: string;
  endpoint: string;
  /** The query string as sent, sorted. */
  input: Record<string, string>;
  /** The whole response body. `null` when nothing came back. */
  returned: Receipt['returned'];
  /** `null` when the request never got a response (network error or timeout). */
  status: number | null;
  calledAt: string;
  durationMs: number;
  /** True when the answer came from this client's own earlier call. */
  cached: boolean;
}

export interface QlooResult<T> {
  data: T;
  call: QlooCall;
}

export type QlooErrorKind = 'http' | 'network' | 'timeout' | 'invalid_response';

/**
 * A call that did not produce usable data. It carries the call record so the line can still
 * cite what was asked and what came back (spec §10: "could not test", never filled by the model).
 */
export class QlooError extends Error {
  constructor(
    message: string,
    readonly kind: QlooErrorKind,
    readonly call: QlooCall,
  ) {
    super(message);
    this.name = 'QlooError';
  }
}

/** Thrown before any request when the run's call budget is spent (stop reason `qloo_budget`). */
export class QlooBudgetError extends Error {
  constructor(
    readonly endpoint: string,
    readonly budget: number,
  ) {
    super(`Qloo call budget of ${budget} is spent, so ${endpoint} was not called`);
    this.name = 'QlooBudgetError';
  }
}

/**
 * Name lookups change slowly, so they are kept across runs: a plan names the same telecoms and
 * comps as the last one. Only `/search` and `/entities` are kept; an insight depends on the signal.
 */
export class LookupCache {
  private readonly kept = new Map<string, { at: number; fetched: Fetched }>();

  constructor(
    // How long an answer may be reused. Default 14 days.
    private readonly ttlMs = 14 * 24 * 60 * 60 * 1000,
    private readonly max = 2000,
  ) {}

  get(key: string): Fetched | null {
    const hit = this.kept.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > this.ttlMs) {
      this.kept.delete(key);
      return null;
    }
    return hit.fetched;
  }

  set(key: string, fetched: Fetched): void {
    if (this.kept.size >= this.max) {
      const oldest = this.kept.keys().next().value;
      if (oldest !== undefined) this.kept.delete(oldest);
    }
    this.kept.set(key, { at: Date.now(), fetched });
  }
}

const LOOKUP_ENDPOINTS = new Set(['/search', '/entities']);

export interface QlooClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per attempt. Tag-signal insights can take a long time. Default 30 000. */
  timeoutMs?: number;
  /** Most network calls this client may make. Default: no limit. Set it from `QLOO_CALL_BUDGET`. */
  callBudget?: number;
  /** Wait before the retry when Qloo sends no `Retry-After`. Default 500. */
  retryDelayMs?: number;
  /**
   * Most requests in flight at once. Default 2: the hackathon host answers 429 to a plan's
   * parallel calls, so the rest wait their turn.
   */
  maxConcurrent?: number;
  /** Name lookups kept across runs. Without one, every run asks again. */
  lookupCache?: LookupCache;
  /** Replaces the global `fetch`. Demo mode and tests pass one so no request leaves the process. */
  fetch?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;
const DEFAULT_MAX_CONCURRENT = 2;
// A 429 with no Retry-After needs longer than a network blip before the one retry: 2 s by default.
const RATE_LIMIT_FACTOR = 4;
const RATE_LIMIT_RETRIES = 2;

interface Fetched {
  returned: Receipt['returned'];
  call: QlooCall;
}

interface Attempt {
  status: number | null;
  returned: Receipt['returned'];
  failure?: 'network' | 'timeout';
  /** How long to wait before retrying, when the attempt is worth retrying. */
  retryAfterMs?: number;
}

/**
 * One client per agent run. Retries once (spec §10). An identical call made again, or while the
 * first is in flight, is served from the run's cache: it is free and gets its own call record.
 */
export class QlooClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly callBudget: number | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly lookupCache: LookupCache | undefined;
  private readonly answers = new Map<string, Promise<Fetched>>();
  private networkCalls = 0;
  private readonly maxConcurrent: number;
  private inFlight = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(options: QlooClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.callBudget = options.callBudget;
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.fetchImpl = options.fetch ?? fetch;
    this.lookupCache = options.lookupCache;
  }

  /** Network calls still allowed. Infinity with no budget. */
  get callsLeft(): number {
    return this.callBudget === undefined
      ? Number.POSITIVE_INFINITY
      : this.callBudget - this.networkCalls;
  }

  /** Network calls made so far. Cache hits do not count. */
  get callsUsed(): number {
    return this.networkCalls;
  }

  async get<S extends z.ZodType>(
    endpoint: string,
    params: QlooParams,
    schema: S,
  ): Promise<QlooResult<z.output<S>>> {
    const input = serializeParams(params);
    const key = `${endpoint}?${JSON.stringify(input)}`;

    const earlier = this.answers.get(key);
    if (earlier) {
      const { returned, call } = await earlier;
      const data = this.validate(schema, endpoint, returned, call);
      return {
        data,
        call: { ...call, callId: randomUUID(), calledAt: now(), durationMs: 0, cached: true },
      };
    }

    // A name looked up in an earlier run is free. Its record keeps the day it was really asked.
    const lookup = LOOKUP_ENDPOINTS.has(endpoint) ? this.lookupCache?.get(key) : undefined;
    if (lookup) {
      this.answers.set(key, Promise.resolve(lookup));
      return {
        data: this.validate(schema, endpoint, lookup.returned, lookup.call),
        call: { ...lookup.call, callId: randomUUID(), durationMs: 0, cached: true },
      };
    }

    if (this.callBudget !== undefined && this.networkCalls >= this.callBudget) {
      throw new QlooBudgetError(endpoint, this.callBudget);
    }
    this.networkCalls += 1;

    const pending = this.fetchWithRetry(endpoint, input);
    this.answers.set(key, pending);
    try {
      const { returned, call } = await pending;
      const data = this.validate(schema, endpoint, returned, call);
      if (LOOKUP_ENDPOINTS.has(endpoint)) this.lookupCache?.set(key, { returned, call });
      return { data, call };
    } catch (err) {
      // Failures are not remembered: the next identical call goes out again.
      this.answers.delete(key);
      throw err;
    }
  }

  private validate<S extends z.ZodType>(
    schema: S,
    endpoint: string,
    returned: Receipt['returned'],
    call: QlooCall,
  ): z.output<S> {
    const parsed = schema.safeParse(returned);
    if (parsed.success) return parsed.data;
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(body)'}: ${issue.message}`)
      .join('; ');
    throw new QlooError(
      `Qloo ${endpoint} returned an unexpected shape: ${issues}`,
      'invalid_response',
      call,
    );
  }

  private async fetchWithRetry(endpoint: string, input: Record<string, string>): Promise<Fetched> {
    const url = new URL(endpoint, this.baseUrl);
    for (const [name, value] of Object.entries(input)) url.searchParams.set(name, value);

    const calledAt = now();
    const started = Date.now();
    let attempt = await this.slot(() => this.attempt(url));
    // One retry for a failure; a rate limit gets a second one, after a longer wait.
    for (let retry = 1; attempt.retryAfterMs !== undefined; retry++) {
      const limited = attempt.status === 429;
      if (retry > (limited ? RATE_LIMIT_RETRIES : 1)) break;
      await sleep(attempt.retryAfterMs * (limited ? retry : 1));
      attempt = await this.slot(() => this.attempt(url));
    }

    const call: QlooCall = {
      callId: randomUUID(),
      endpoint,
      input,
      returned: attempt.returned,
      status: attempt.status,
      calledAt,
      durationMs: Date.now() - started,
      cached: false,
    };
    if (attempt.failure === 'timeout') {
      throw new QlooError(`Qloo ${endpoint} timed out after ${this.timeoutMs} ms`, 'timeout', call);
    }
    if (attempt.failure === 'network') {
      throw new QlooError(`Qloo ${endpoint} could not be reached`, 'network', call);
    }
    if (attempt.status === null || attempt.status < 200 || attempt.status >= 300) {
      throw new QlooError(`Qloo ${endpoint} failed with status ${attempt.status}`, 'http', call);
    }
    return { returned: attempt.returned, call };
  }

  // Runs one request when a slot is free. A finished request hands its slot to the next one.
  private async slot<T>(work: () => Promise<T>): Promise<T> {
    if (this.inFlight < this.maxConcurrent) this.inFlight += 1;
    else await new Promise<void>((resolve) => this.waiting.push(resolve));
    try {
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.inFlight -= 1;
    }
  }

  private async attempt(url: URL): Promise<Attempt> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { 'X-Api-Key': this.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const failure =
        err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'network';
      return { status: null, returned: null, failure, retryAfterMs: this.retryDelayMs };
    }

    const returned = await readBody(response);
    const retryable = response.status === 429 || response.status >= 500;
    return {
      status: response.status,
      returned,
      ...(retryable ? { retryAfterMs: this.retryWait(response) } : {}),
    };
  }

  private retryWait(response: Response): number {
    const seconds = Number(response.headers.get('retry-after'));
    if (Number.isFinite(seconds) && seconds > 0)
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    return response.status === 429 ? this.retryDelayMs * RATE_LIMIT_FACTOR : this.retryDelayMs;
  }
}

// The body as JSON, or as text when it is not JSON (an HTML error page, say).
async function readBody(response: Response): Promise<Receipt['returned']> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
