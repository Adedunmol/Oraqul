import type { Receipt } from '@oraqul/schema';
import { buildReceipt, type ToolResult } from '../receipts';

export interface QlooClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'QlooError';
  }
}

interface RequestOptions {
  endpoint: string;
  params: Record<string, string | number | boolean>;
  rule: string;
}

/**
 * Thin Qloo HTTP client. Retries once on failure, then throws QlooError
 * (spec section 10: never fill from the model).
 *
 * TODO(verify): auth header name and response envelope come from secondhand
 * notes. Confirm against Qloo's docs and our own key. See docs/backend/qloo.md.
 */
export class QlooClient {
  private readonly timeoutMs: number;

  constructor(private readonly options: QlooClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async request<T>({ endpoint, params, rule }: RequestOptions): Promise<ToolResult<T>> {
    const body = await this.fetchWithRetry(endpoint, params);
    const receipt: Receipt = buildReceipt({
      endpoint,
      input: params,
      returned: body as Receipt['returned'],
      rule,
      confidence: 'medium',
    });
    return { data: body as T, receipt };
  }

  private async fetchWithRetry(
    endpoint: string,
    params: RequestOptions['params'],
  ): Promise<unknown> {
    try {
      return await this.fetchOnce(endpoint, params);
    } catch {
      return await this.fetchOnce(endpoint, params);
    }
  }

  private async fetchOnce(endpoint: string, params: RequestOptions['params']): Promise<unknown> {
    const url = new URL(endpoint, this.options.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      headers: { 'x-api-key': this.options.apiKey },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new QlooError(`Qloo ${endpoint} failed`, response.status);
    }
    return response.json();
  }
}
