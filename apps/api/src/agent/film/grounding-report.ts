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
}

/**
 * A measure of how well backed a plan is (spec §6.2), so "better grounded than a plain answer" can
 * be tracked and compared instead of read by eye. Computed from the saved plan alone. It counts
 * citations, not their quality: that is what the line check and the eval runs are for.
 */
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
  return {
    lines: lines.length,
    grounded: grounded.length,
    sourced: sourced.length,
    playbook: lines.length - backed.length,
    backed: lines.length ? Math.round((backed.length / lines.length) * 100) : 0,
    findingsUsed: plan.findings.filter((f) => used.has(f.id)).length,
    findingsTotal: plan.findings.length,
    dropped: plan.dropped.length,
    cities: Object.fromEntries(
      teamCities.map((city) => [
        city,
        grounded.filter((l) => lower(`${l.group ?? ''} ${l.text}`).includes(lower(city))).length,
      ]),
    ),
  };
}
