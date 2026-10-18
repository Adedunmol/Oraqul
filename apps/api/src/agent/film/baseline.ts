import { resolveBundleOutputSchema, type ToolContext, tools } from '@oraqul/engine';
import { packs } from '@oraqul/packs';
import type { QlooEntityType, Receipt } from '@oraqul/schema';

// Mass-market names a named partner is scored against, so a partner brief can say how much more
// this audience likes it than the biggest names. A confidence aid, never how partners are picked
// (spec §5.2: lift over a mass-market baseline rewards anything niche).

// Baseline names resolve to the same entities on every run, so the search is made once per
// process. A name that is not one exact match is remembered as null and left out.
const baselineCache = new Map<string, { entityId: string; name: string } | null>();

export async function baselineFor(
  ctx: ToolContext,
  keep: (made: Receipt[]) => void,
  type: QlooEntityType,
): Promise<{ entityId: string; name: string }[]> {
  const names = packs.film.baselines[type] ?? [];
  const missing = names.filter((n) => !baselineCache.has(`${ctx.source}:${type}:${n}`));
  if (missing.length) {
    const { data, receipts } = await tools.resolveBundle.run(ctx, {
      names: missing,
      types: [type],
    });
    keep(receipts);
    for (const a of resolveBundleOutputSchema.parse(data).anchors) {
      if (a.status === 'failed') continue;
      baselineCache.set(
        `${ctx.source}:${type}:${a.name}`,
        a.status === 'found' && a.entityId ? { entityId: a.entityId, name: a.name } : null,
      );
    }
  }
  return names.flatMap((n) => baselineCache.get(`${ctx.source}:${type}:${n}`) ?? []);
}

/** Forgets the baseline searches, so a recorded run captures them again. Tests only. */
export function clearBaselineCache(): void {
  baselineCache.clear();
}
