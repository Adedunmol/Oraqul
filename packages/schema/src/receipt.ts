import { z } from 'zod';
import { confidenceSchema } from './verdict';

export const receiptSchema = z.object({
  callId: z.string().uuid(),
  lineId: z.string().optional(),
  endpoint: z.string(),
  input: z.record(z.string(), z.json()),
  returned: z.json(),
  rule: z.string(),
  confidence: confidenceSchema,
  calledAt: z.string().datetime(),
  /** `demo` receipts come from hand-written data and must never be shown as Qloo's. */
  source: z.enum(['qloo', 'demo']),
});
export type Receipt = z.infer<typeof receiptSchema>;
