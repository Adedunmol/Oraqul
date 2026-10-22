import type { Confidence, Finding, Understanding } from '@oraqul/schema';

const RANK: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

/** A finding's pull on a check: how sure Qloo's data is, then how strongly it ranked its top name. */
function strength(f: Finding): [number, number] {
  return [RANK[f.confidence], f.entities[0]?.affinity ?? 0];
}

/**
 * Orders the findings that bear on each check, strongest first, so the writer leads with the
 * best-measured evidence. Code only: the model never ranks (hard rule 1).
 */
export function rankEvidence(
  criteria: Understanding['criteria'],
  findings: Finding[],
): Understanding['criteria'] {
  const byId = new Map(findings.map((f) => [f.id, f]));
  return criteria.map((c) => ({
    ...c,
    findingIds: c.findingIds
      .flatMap((id) => {
        const f = byId.get(id);
        return f ? [f] : [];
      })
      .sort((a, b) => {
        const [ac, aa] = strength(a);
        const [bc, ba] = strength(b);
        return bc - ac || ba - aa;
      })
      .map((f) => f.id),
  }));
}

/** What each check rests on, for the writer: the strongest findings first, or that none measured it. */
export function evidenceBlock(criteria: Understanding['criteria'], findings: Finding[]): string {
  const byId = new Map(findings.map((f) => [f.id, f]));
  return criteria
    .map((c) => {
      const ids = c.findingIds.filter((id) => byId.has(id));
      return ids.length
        ? `- ${c.text} [${c.status}]: ${ids.map((id) => `${id} (${byId.get(id)?.confidence})`).join(', ')}`
        : `- ${c.text} [${c.status}]: nothing measured for this`;
    })
    .join('\n');
}
