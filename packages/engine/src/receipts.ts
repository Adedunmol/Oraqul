import type { Confidence, Receipt } from '@oraqul/schema';
import type { QlooCall } from './qloo/client';

export interface ToolResult<T> {
  data: T;
  receipt: Receipt;
}

interface ReceiptInput {
  /** How the tool used this call, in words a marketer can read. Published with the receipt. */
  rule: string;
  /** Computed by the tool from spec §5. Never a default. */
  confidence: Confidence;
  lineId?: string;
}

/** A Qloo call, as a receipt for one line of an output. */
export function toReceipt(call: QlooCall, { rule, confidence, lineId }: ReceiptInput): Receipt {
  return {
    callId: call.callId,
    ...(lineId ? { lineId } : {}),
    endpoint: call.endpoint,
    input: call.input,
    returned: call.returned,
    rule,
    confidence,
    calledAt: call.calledAt,
  };
}
