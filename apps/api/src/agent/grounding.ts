import type { AgentReply, Receipt } from '@oraqul/schema';

/**
 * Claims that cite a receipt this run never produced. A basic form of the output validator in
 * spec §10. It does not yet check entity names or numbers in the text against the receipts.
 */
export function ungroundedClaims(reply: AgentReply, receipts: Receipt[]): string[] {
  const known = new Set(receipts.map((r) => r.callId));
  return reply.claims
    .filter((claim) => claim.receiptIds.some((id) => !known.has(id)))
    .map((claim) => claim.text);
}
