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

export interface QlooClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per attempt. Tag-signal insights can take a long time. Default 30 000. */
  timeoutMs?: number;
  /** Most network calls this client may make. Default: no limit. Set it from `QLOO_CALL_BUDGET`. */
  callBudget?: number;
  /** Wait before the retry when Qloo sends no `Retry-After`. Default 500. */
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;

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
 * One client per agent run. Retries once (spec §10), validates every response, counts network
 * calls against the budget, and remembers answers for the rest of the run: an identical call
 * made again, or while the first is still in flight, is free and gets its own call record.
 *
 * Auth and endpoints follow docs.qloo.com. See docs/backend/qloo.md for what is confirmed.
 */
export class QlooClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly callBudget: number | undefined;
  private readonly answers = new Map<string, Promise<Fetched>>();
  private networkCalls = 0;

  constructor(options: QlooClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.callBudget = options.callBudget;
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

    if (this.callBudget !== undefined && this.networkCalls >= this.callBudget) {
      throw new QlooBudgetError(endpoint, this.callBudget);
    }
    this.networkCalls += 1;

    const pending = this.fetchWithRetry(endpoint, input);
    this.answers.set(key, pending);
    try {
      const { returned, call } = await pending;
      return { data: this.validate(schema, endpoint, returned, call), call };
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
    let attempt = await this.attempt(url);
    if (attempt.retryAfterMs !== undefined) {
      await sleep(attempt.retryAfterMs);
      attempt = await this.attempt(url);
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

  private async attempt(url: URL): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetch(url, {
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
    return this.retryDelayMs;
  }
}

/** The body as JSON, or as text when it is not JSON (an HTML error page, say). */
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
