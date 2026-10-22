/** One saved plan, as the weekly error review reads it. */
export interface SampledPlan {
  id: string;
  category: string | null;
  headline: string | null;
  confidence: string | null;
  /** What the plan could not test, each with Qloo's or the code's reason. */
  cannot: { item: string; why: string }[];
  /** Lines the check dropped because no source supported them. */
  dropped: number;
}

export interface Tally {
  key: string;
  count: number;
  /** The most common reason given for it. */
  why: string;
}

/**
 * Groups what the sampled plans could not test, most common first. The counts decide which check
 * or golden run to add next (decision D43): fix the item that fails in the most plans, not the one
 * that failed last.
 */
export function tallyCannot(plans: SampledPlan[]): Tally[] {
  const byItem = new Map<string, { count: number; whys: Map<string, number> }>();
  for (const plan of plans) {
    // One plan counts once for an item, however many times it listed it.
    for (const item of new Set(plan.cannot.map((c) => c.item))) {
      const entry = byItem.get(item) ?? { count: 0, whys: new Map<string, number>() };
      entry.count += 1;
      for (const c of plan.cannot.filter((x) => x.item === item)) {
        entry.whys.set(c.why, (entry.whys.get(c.why) ?? 0) + 1);
      }
      byItem.set(item, entry);
    }
  }
  return [...byItem.entries()]
    .map(([key, v]) => ({
      key,
      count: v.count,
      why: [...v.whys.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
