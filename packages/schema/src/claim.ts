import { z } from 'zod';

/** A sentence in an output and the receipts that back it. A claim with no receipt is invalid. */
export const claimSchema = z.object({
  text: z.string(),
  receiptIds: z.array(z.string().uuid()).min(1),
});
export type Claim = z.infer<typeof claimSchema>;
