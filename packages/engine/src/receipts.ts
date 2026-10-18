import type { Confidence, Receipt } from '@oraqul/schema';
import type { QlooCall } from './qloo/client';

/** A tool's answer and one receipt per Qloo call it made. `data` names the receipt behind each item. */
export interface ToolResult<T> {
  data: T;
  receipts: Receipt[];
}

interface ReceiptInput {
  /**
   * The part of the response this line used: the few results and numbers behind the claim.
   * Not the whole body. Live responses run to hundreds of kilobytes (a movie carries 300+ tags)
   * and a locality heatmap to megabytes, and raw Qloo data is not for public share links.
   */
  returned: Receipt['returned'];
  /** How the tool used this call, in words a marketer can read. Published with the receipt. */
  rule: string;
  /** Computed by the tool from spec §5. Never a default. */
  confidence: Confidence;
  lineId?: string;
  /** `demo` when the call was served by demo data. */
  source: Receipt['source'];
}

/** A Qloo call, as a receipt for one line of an output. */
export function toReceipt(
  call: QlooCall,
  { returned, rule, confidence, lineId, source }: ReceiptInput,
): Receipt {
  return {
    callId: call.callId,
    ...(lineId ? { lineId } : {}),
    endpoint: call.endpoint,
    input: call.input,
    returned,
    rule,
    confidence,
    calledAt: call.calledAt,
    source,
  };
}
