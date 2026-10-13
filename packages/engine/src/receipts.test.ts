import { receiptSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { QlooCall } from './qloo';
import { toReceipt } from './receipts';

const call: QlooCall = {
  callId: '3f1c2a8e-7c1d-4b53-9a53-0d6c1f5f9a10',
  endpoint: '/v2/insights',
  input: { 'filter.type': 'urn:demographics', 'signal.interests.entities': 'E1' },
  returned: { results: { demographics: [] } },
  status: 200,
  calledAt: '2026-10-13T12:00:00.000Z',
  durationMs: 420,
  cached: false,
};

describe('toReceipt', () => {
  it('builds a valid receipt from a call and the tool’s own rule and confidence', () => {
    const receipt = toReceipt(call, {
      returned: { age: { '25_to_29': 0.43 } },
      rule: 'Age skew is the affinity per band for the signal',
      confidence: 'high',
      lineId: 'a1',
    });
    expect(receiptSchema.parse(receipt)).toEqual({
      callId: call.callId,
      lineId: 'a1',
      endpoint: call.endpoint,
      input: call.input,
      returned: { age: { '25_to_29': 0.43 } },
      rule: 'Age skew is the affinity per band for the signal',
      confidence: 'high',
      calledAt: call.calledAt,
    });
  });

  it('leaves lineId out when there is none', () => {
    const receipt = toReceipt(call, { returned: null, rule: 'r', confidence: 'lower' });
    expect('lineId' in receipt).toBe(false);
  });
});
