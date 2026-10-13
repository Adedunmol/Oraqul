import { randomUUID } from 'node:crypto';
import type { Confidence, Receipt } from '@oraqul/schema';

export interface ToolResult<T> {
  data: T;
  receipt: Receipt;
}

interface ReceiptInput {
  endpoint: string;
  input: Receipt['input'];
  returned: Receipt['returned'];
  rule: string;
  confidence: Confidence;
  lineId?: string;
}

export function buildReceipt({ lineId, ...rest }: ReceiptInput): Receipt {
  return {
    callId: randomUUID(),
    ...(lineId ? { lineId } : {}),
    ...rest,
    calledAt: new Date().toISOString(),
  };
}
