import { type Receipt, receiptSchema } from '@oraqul/schema';
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
  return { qloo, source: 'demo' as const, entities: new Map() };
}

function onlyReceipt({ receipts }: { receipts: Receipt[] }): Receipt {
  expect(receipts).toHaveLength(1);
  const [receipt] = receipts;
  if (!receipt) throw new Error('No receipt');
  return receipt;
}

describe('searchEntity', () => {
  it('returns one candidate with a demo receipt', async () => {
    const result = await tools.searchEntity.run(demoContext(), {
      name: 'The Glass Lantern',
      types: ['urn:entity:book'],
    });
    const { data } = result;
    const receipt = onlyReceipt(result);
    expect(data).toMatchObject({ ambiguous: false, candidates: [{ entityId: 'DEMO-BOOK-0001' }] });
    expect(receiptSchema.parse(receipt)).toMatchObject({ source: 'demo', confidence: 'high' });
  });

  it('flags a title that is both a film and a series', async () => {
    const result = await tools.searchEntity.run(demoContext(), {
      name: 'Midnight Harbor',
      types: ['urn:entity:movie', 'urn:entity:tv_show'],
    });
    const { data } = result;
    const receipt = onlyReceipt(result);
    expect(data).toMatchObject({ ambiguous: true });
    expect(receipt.confidence).toBe('lower');
  });

  it('rejects input that does not match the schema', async () => {
    await expect(tools.searchEntity.run(demoContext(), { name: '' })).rejects.toThrow();
  });
});

describe('audienceBySegment', () => {
  it('computes the top age band in code', async () => {
    const result = await tools.audienceBySegment.run(demoContext(), {
      entityIds: ['DEMO-FILM-0001'],
    });
    const { data } = result;
    const receipt = onlyReceipt(result);
    expect(data).toMatchObject({
      segments: [{ entityId: 'DEMO-FILM-0001', topAgeBand: '24_and_younger' }],
    });
    expect(receipt.source).toBe('demo');
  });

  it('counts anchors Qloo knows from the run searches, not from the input', async () => {
    const ctx = demoContext();
    const films = ['urn:entity:movie' as const];
    for (const name of ['Midnight Harbor', 'Salt Road', 'The Glass Lantern']) {
      await tools.searchEntity.run(ctx, { name, types: films });
    }
    const entityIds = ['DEMO-FILM-0001', 'DEMO-FILM-0003', 'DEMO-FILM-0004'];
    const searched = await tools.audienceBySegment.run(ctx, { entityIds });
    expect(onlyReceipt(searched).confidence).toBe('high');
    expect(onlyReceipt(searched).rule).toContain('3 of 3 returned a row');

    const unsearched = await tools.audienceBySegment.run(demoContext(), { entityIds });
    expect(onlyReceipt(unsearched).confidence).toBe('lower');
    expect(onlyReceipt(unsearched).rule).toContain('no anchor Qloo knows well');
  });

  it('lowers confidence when Qloo has no row for the entity', async () => {
    const result = await tools.audienceBySegment.run(demoContext(), {
      entityIds: ['NOPE'],
    });
    const { data } = result;
    const receipt = onlyReceipt(result);
    expect(data).toMatchObject({ segments: [], confidence: 'lower' });
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
