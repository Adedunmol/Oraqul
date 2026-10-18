import type { AgentReply, Brief, Receipt } from '@oraqul/schema';

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

/**
 * Brief lines that are not grounded (spec §10, hard rule 2). Lines that could not be tested, risks
 * and the untested list carry no receipt by design.
 */
export function ungroundedLines(brief: Brief, receipts: Receipt[]): string[] {
  const byLine = new Map<string, Receipt[]>();
  for (const r of receipts) {
    if (r.lineId) byLine.set(r.lineId, [...(byLine.get(r.lineId) ?? []), r]);
  }
  const said = (lineId: string, name: string) =>
    (byLine.get(lineId) ?? []).some((r) =>
      JSON.stringify(r.returned).includes(JSON.stringify(name).slice(1, -1)),
    );
  const problems: string[] = [];
  const need = (id: string, label: string) => {
    if (!byLine.has(id)) problems.push(`${label}: no receipt`);
  };
  for (const a of brief.assumptions) if (a.verdict !== 'cant') need(a.id, a.text);
  for (const a of brief.audience) need(a.id, a.name);
  for (const key of ['s1', 's2', 's3', 's4'] as const) {
    for (const l of brief[key]) {
      need(l.id, l.name);
      if (byLine.has(l.id) && !said(l.id, l.name))
        problems.push(`${l.name}: not in what Qloo returned`);
    }
  }
  for (const p of brief.places) {
    need(p.id, p.name);
    if (byLine.has(p.id) && !said(p.id, p.name))
      problems.push(`${p.name}: not in what Qloo returned`);
  }
  for (const d of brief.dates) {
    need(d.id, d.rival);
    if (byLine.has(d.id) && !said(d.id, d.rival))
      problems.push(`${d.rival}: not in what Qloo returned`);
  }
  for (const p of brief.partners) {
    need(p.id, p.name);
    if (byLine.has(p.id) && !said(p.id, p.name))
      problems.push(`${p.name}: not in what Qloo returned`);
  }
  return problems;
}
