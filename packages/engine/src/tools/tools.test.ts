import { receiptSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { demoFetch, QlooBudgetError, QlooClient } from '../qloo';
import { tools } from './index';

function demoContext(callBudget?: number) {
  const qloo = new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: demoFetch,
    callBudget,
  });
  return { qloo, source: 'demo' as const };
}

describe('searchEntity', () => {
  it('returns one candidate with a demo receipt', async () => {
    const { data, receipt } = await tools.searchEntity.run(demoContext(), {
      name: 'The Glass Lantern',
      types: ['urn:entity:book'],
    });
    expect(data).toMatchObject({ ambiguous: false, candidates: [{ entityId: 'DEMO-BOOK-0001' }] });
    expect(receiptSchema.parse(receipt)).toMatchObject({ source: 'demo', confidence: 'high' });
  });

  it('flags a title that is both a film and a series', async () => {
    const { data, receipt } = await tools.searchEntity.run(demoContext(), {
      name: 'Midnight Harbor',
      types: ['urn:entity:movie', 'urn:entity:tv_show'],
    });
    expect(data).toMatchObject({ ambiguous: true });
    expect(receipt.confidence).toBe('lower');
  });

  it('rejects input that does not match the schema', async () => {
    await expect(tools.searchEntity.run(demoContext(), { name: '' })).rejects.toThrow();
  });
});

describe('audienceBySegment', () => {
  it('computes the top age band in code', async () => {
    const { data, receipt } = await tools.audienceBySegment.run(demoContext(), {
      entityIds: ['DEMO-FILM-0001'],
    });
    expect(data).toMatchObject({
      segments: [{ entityId: 'DEMO-FILM-0001', topAgeBand: '24_and_younger' }],
    });
    expect(receipt.source).toBe('demo');
  });

  it('lowers confidence when Qloo has no row for the entity', async () => {
    const { data, receipt } = await tools.audienceBySegment.run(demoContext(), {
      entityIds: ['NOPE'],
    });
    expect(data).toEqual({ segments: [] });
    expect(receipt.confidence).toBe('lower');
  });
});

describe('call budget', () => {
  it('surfaces QlooBudgetError from a tool', async () => {
    const ctx = demoContext(1);
    await tools.searchEntity.run(ctx, { name: 'Salt Road', types: ['urn:entity:movie'] });
    await expect(
      tools.audienceBySegment.run(ctx, { entityIds: ['DEMO-FILM-0003'] }),
    ).rejects.toBeInstanceOf(QlooBudgetError);
  });
});
