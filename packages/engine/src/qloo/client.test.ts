import { afterEach, describe, expect, it, vi } from 'vitest';
import { QlooBudgetError, QlooError } from './client';
import { entityListBody, jsonResponse, stubFetch, testClient } from './fake-fetch';
import * as lookup from './lookup';
import { entityListResponseSchema } from './responses';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const get = (client = testClient(), params: Record<string, string> = { query: 'a' }) =>
  client.get('/search', params, entityListResponseSchema);

describe('QlooClient.get', () => {
  it('sends the key and sorted params, and returns data with a call record', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody));
    const { data, call } = await get(testClient(), { query: 'Some Film', take: '5' });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://qloo.test/search?query=Some+Film&take=5');
    expect(init?.headers).toMatchObject({ 'X-Api-Key': 'test-key' });
    expect(data.results[0]?.entity_id).toBe('E1');
    expect(call).toMatchObject({
      endpoint: '/search',
      input: { query: 'Some Film', take: '5' },
      returned: entityListBody,
      status: 200,
      cached: false,
    });
    expect(new Date(call.calledAt).toISOString()).toBe(call.calledAt);
  });

  it('answers an identical later call from memory, with its own call record', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody));
    const client = testClient();
    const first = await get(client);
    const second = await get(client);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.callsUsed).toBe(1);
    expect(second.call.cached).toBe(true);
    expect(second.call.durationMs).toBe(0);
    expect(second.call.callId).not.toBe(first.call.callId);
    expect(second.call.returned).toEqual(first.call.returned);
  });

  it('joins identical calls made while the first is still in flight', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody));
    const client = testClient();
    const [a, b] = await Promise.all([get(client), get(client)]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.callsUsed).toBe(1);
    expect(a.call.cached).toBe(false);
    expect(b.call.cached).toBe(true);
  });

  it('does not treat different params as the same call', async () => {
    const fetch = stubFetch(jsonResponse(entityListBody), jsonResponse(entityListBody));
    const client = testClient();
    await get(client, { query: 'a' });
    await get(client, { query: 'b' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  describe('retries', () => {
    it('retries once on a server error and spends one budget unit', async () => {
      const fetch = stubFetch(jsonResponse({}, { status: 503 }), jsonResponse(entityListBody));
      const client = testClient();
      const { call } = await get(client);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(client.callsUsed).toBe(1);
      expect(call.status).toBe(200);
    });

    it('gives up after one retry and keeps the failed call on the error', async () => {
      const fetch = stubFetch(
        jsonResponse({ message: 'down' }, { status: 500 }),
        jsonResponse({ message: 'still down' }, { status: 500 }),
      );
      const error = await get().catch((e: unknown) => e);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(error).toBeInstanceOf(QlooError);
      expect(error).toMatchObject({
        kind: 'http',
        call: { status: 500, returned: { message: 'still down' }, endpoint: '/search' },
      });
    });

    it('does not retry a client error', async () => {
      const fetch = stubFetch(jsonResponse({ message: 'bad' }, { status: 400 }));
      await expect(get()).rejects.toMatchObject({ kind: 'http', call: { status: 400 } });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 404', async () => {
      const fetch = stubFetch(jsonResponse({ message: 'none' }, { status: 404 }));
      await expect(get()).rejects.toMatchObject({ kind: 'http', call: { status: 404 } });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('waits for Retry-After on a 429, up to a cap', async () => {
      vi.useFakeTimers();
      const fetch = stubFetch(
        jsonResponse({}, { status: 429, headers: { 'retry-after': '2' } }),
        jsonResponse(entityListBody),
      );
      const pending = get();
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('caps a very long Retry-After', async () => {
      vi.useFakeTimers();
      const fetch = stubFetch(
        jsonResponse({}, { status: 429, headers: { 'retry-after': '600' } }),
        jsonResponse(entityListBody),
      );
      const pending = get();
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('gives a rate limit a second retry, then stops', async () => {
      const limited = () => jsonResponse({}, { status: 429 });
      const twice = stubFetch(limited(), limited(), jsonResponse(entityListBody));
      await get();
      expect(twice).toHaveBeenCalledTimes(3);

      const always = stubFetch(limited(), limited(), limited());
      await expect(get()).rejects.toMatchObject({ kind: 'http', call: { status: 429 } });
      expect(always).toHaveBeenCalledTimes(3);
    });

    it('retries once after a network error', async () => {
      const fetch = stubFetch(new TypeError('fetch failed'), jsonResponse(entityListBody));
      await get();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('failures', () => {
    it('reports a network error with no status', async () => {
      stubFetch(new TypeError('fetch failed'), new TypeError('fetch failed'));
      await expect(get()).rejects.toMatchObject({
        kind: 'network',
        call: { status: null, returned: null },
      });
    });

    it('reports a timeout', async () => {
      stubFetch(
        new DOMException('timed out', 'TimeoutError'),
        new DOMException('timed out', 'TimeoutError'),
      );
      await expect(get()).rejects.toMatchObject({ kind: 'timeout' });
    });

    it('keeps a non-JSON error body as text', async () => {
      stubFetch(
        new Response('<html>bad gateway</html>', { status: 502 }),
        new Response('<html>bad gateway</html>', { status: 502 }),
      );
      await expect(get()).rejects.toMatchObject({
        kind: 'http',
        call: { returned: '<html>bad gateway</html>' },
      });
    });

    it('rejects a body that does not match the schema, and keeps what came back', async () => {
      stubFetch(jsonResponse({ results: [{ name: 'no id' }] }));
      const error = await get().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(QlooError);
      expect(error).toMatchObject({
        kind: 'invalid_response',
        call: { status: 200, returned: { results: [{ name: 'no id' }] } },
      });
      expect((error as QlooError).message).toContain('results.0.entity_id');
    });

    it('does not remember a failed call', async () => {
      const fetch = stubFetch(jsonResponse({}, { status: 400 }), jsonResponse(entityListBody));
      const client = testClient();
      await expect(get(client)).rejects.toBeInstanceOf(QlooError);
      await get(client);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrency', () => {
    it('keeps at most maxConcurrent requests in flight', async () => {
      let inFlight = 0;
      let most = 0;
      const slow: typeof fetch = async () => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return new Response(JSON.stringify({ success: true, results: [] }), { status: 200 });
      };
      const client = testClient({ fetch: slow, maxConcurrent: 2 });
      await Promise.all(['a', 'b', 'c', 'd', 'e'].map((query) => lookup.search(client, { query })));
      expect(most).toBe(2);
    });
  });

  describe('budget', () => {
    it('stops before calling Qloo once the budget is spent', async () => {
      const fetch = stubFetch(jsonResponse(entityListBody));
      const client = testClient({ callBudget: 1 });
      await get(client, { query: 'a' });
      await expect(get(client, { query: 'b' })).rejects.toBeInstanceOf(QlooBudgetError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('still answers a repeated call from memory when the budget is spent', async () => {
      stubFetch(jsonResponse(entityListBody));
      const client = testClient({ callBudget: 1 });
      await get(client);
      await expect(get(client)).resolves.toMatchObject({ call: { cached: true } });
    });
  });
});
