import type { LaunchPlan } from '@oraqul/schema';

/** How much of a plan rests on what Qloo returned and what a web page states. */
export interface GroundingReport {
  lines: number;
  /** Lines that cite at least one Qloo finding. */
  grounded: number;
  /** Lines that cite at least one web page. */
  sourced: number;
  /** Lines of launch practice that cite nothing. */
  playbook: number;
  /** The share of lines that cite a finding or a page, 0 to 100. */
  backed: number;
  /** Findings the plan used, of those Qloo returned. */
  findingsUsed: number;
  findingsTotal: number;
  /** Lines the check removed, so a high score cannot hide a plan that was cut down. */
  dropped: number;
  /** For each city the team chose, the grounded lines that name it, in the text or the group heading. */
  cities: Record<string, number>;
  /** Share of name pairs written in Qloo's order, 0 to 100. A plan with no such pair scores 100. */
  rankKept: number;
  /** How many pairs that share is of. */
  rankPairs: number;
}

/** How well backed a plan is (spec §6.2). Counts citations, not whether they are right. */
// A name without its bracketed tell-apart, such as a year or an abbreviation, in lower case.
const plain = (name: string) =>
  name
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .toLowerCase();

// Pairs of names a line takes from the same finding, as [in Qloo's order, in the line's order]
// positions. A name the line does not write, or writes inside another, is not counted.
function orderPairs(plan: LaunchPlan, line: LaunchPlan['sections'][number]['lines'][number]) {
  const text = line.text.toLowerCase();
  let kept = 0;
  let total = 0;
  for (const id of line.findingIds) {
    const finding = plan.findings.find((f) => f.id === id);
    if (!finding) continue;
    const at = finding.entities
      .map((e) => ({ rank: finding.entities.indexOf(e), at: text.indexOf(plain(e.name)) }))
      .filter((e) => e.at >= 0 && plain(finding.entities[e.rank]?.name ?? '').length >= 4);
    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) {
        const a = at[i];
        const b = at[j];
        if (!a || !b) continue;
        total += 1;
        // Entities are in Qloo's order, so a lower index is ranked higher.
        if (a.rank < b.rank === a.at < b.at) kept += 1;
      }
    }
  }
  return { kept, total };
}

export function groundingReport(plan: LaunchPlan, teamCities: string[]): GroundingReport {
  const lines = plan.sections
    // To sharpen and Budget split are written by code and cite nothing by design.
    .filter((s) => s.key !== 'gaps' && s.key !== 'budget')
    .flatMap((s) => s.lines);
  const grounded = lines.filter((l) => l.findingIds.length > 0);
  const sourced = lines.filter((l) => l.sourceIds.length > 0);
  const backed = lines.filter((l) => l.findingIds.length > 0 || l.sourceIds.length > 0);
  const used = new Set(lines.flatMap((l) => l.findingIds));
  const lower = (t: string) => t.toLowerCase();
  const order = grounded.map((l) => orderPairs(plan, l));
  const pairs = order.reduce((n, o) => n + o.total, 0);
  const kept = order.reduce((n, o) => n + o.kept, 0);
  return {
    lines: lines.length,
    grounded: grounded.length,
    sourced: sourced.length,
    playbook: lines.length - backed.length,
    backed: lines.length ? Math.round((backed.length / lines.length) * 100) : 0,
    findingsUsed: plan.findings.filter((f) => used.has(f.id)).length,
    findingsTotal: plan.findings.length,
    dropped: plan.dropped.length,
    rankKept: pairs ? Math.round((kept / pairs) * 100) : 100,
    rankPairs: pairs,
    cities: Object.fromEntries(
      teamCities.map((city) => [
        city,
        grounded.filter((l) => lower(`${l.group ?? ''} ${l.text}`).includes(lower(city))).length,
      ]),
    ),
  };
}
