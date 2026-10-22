import type { LaunchModuleKey } from '@oraqul/schema';
import type { LaunchRead } from './read-core.js';

interface ModulePick {
  modules: LaunchModuleKey[];
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules every full plan carries whatever the category: where to lead per territory, written by
 * code. A category's own list stays as it is (Film's is frozen); these are added beside it, just
 * before the timeline or the budget, so the plan still ends on the practical sections. A narrow
 * ask gets none, and `channels` needs a city to plan for.
 */
export function withSharedModules(
  pick: ModulePick,
  read: Pick<LaunchRead, 'scope' | 'places'>,
): ModulePick {
  if (read.scope !== 'full') return pick;
  const shared: LaunchModuleKey[] = [
    ...(read.places.length > 0 ? (['channels'] as const) : []),
    'creative',
  ];
  const wanted = shared.filter((key) => !pick.modules.includes(key));
  if (wanted.length === 0) return pick;
  const at = pick.modules.findIndex((k) => k === 'timeline' || k === 'budget');
  const modules = [...pick.modules];
  modules.splice(at === -1 ? modules.length : at, 0, ...wanted);
  return { ...pick, modules };
}
