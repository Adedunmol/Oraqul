import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { demoFetch, QlooClient } from '@oraqul/engine';
import { receiptSchema, toolNames } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { createServer } from './server';

async function connect(callBudget?: number) {
  const qloo = new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: demoFetch,
    callBudget,
  });
  const server = createServer({ qloo, source: 'demo' });
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const first = Array.isArray(result.content) ? result.content[0] : undefined;
  if (first?.type !== 'text') throw new Error('Expected text content');
  return first.text;
}

describe('mcp server', () => {
  it('lists every engine tool', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...toolNames].sort());
  });

  it('returns data and a demo receipt', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'searchEntity',
      arguments: { name: 'Salt Road', types: ['urn:entity:movie'] },
    });
    const body = JSON.parse(textOf(result));
    expect(body.data.candidates[0].entityId).toBe('DEMO-FILM-0003');
    expect(receiptSchema.parse(body.receipt).source).toBe('demo');
  });

  it('answers a spent call budget as an error result, not a crash', async () => {
    const client = await connect(1);
    await client.callTool({
      name: 'searchEntity',
      arguments: { name: 'Salt Road', types: ['urn:entity:movie'] },
    });
    const result = await client.callTool({
      name: 'audienceBySegment',
      arguments: { entityIds: ['DEMO-FILM-0003'] },
    });
    expect(result.isError).toBe(true);
  });

  it('rejects input that does not match a tool’s schema', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'searchEntity', arguments: { name: '' } });
    expect(result.isError).toBe(true);
  });
});
