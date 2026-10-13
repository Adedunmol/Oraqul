import { vi } from 'vitest';
import { QlooClient, type QlooClientOptions } from './client';

// Test helpers: Qloo is never called from tests.

export function jsonResponse(
  body: object,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers });
}

/** Replaces `fetch` with one that answers from `replies` in order. An Error is thrown instead. */
export function stubFetch(...replies: (Response | Error)[]) {
  const queue = [...replies];
  const fake = vi.fn(async (_url: URL | string, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error('fetch was called more times than the test expected');
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fake);
  return fake;
}

export function testClient(options: Partial<QlooClientOptions> = {}): QlooClient {
  return new QlooClient({
    baseUrl: 'https://qloo.test',
    apiKey: 'test-key',
    retryDelayMs: 0,
    ...options,
  });
}

export const entityListBody = {
  success: true,
  results: [{ entity_id: 'E1', name: 'Some Film', popularity: 0.5 }],
};

export const entityInsightsBody = {
  success: true,
  results: { entities: [{ entity_id: 'E1', name: 'Some Film', query: { affinity: 0.8 } }] },
};
