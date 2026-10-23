import type { CategoryInfo } from '@oraqul/schema';

/**
 * What Oraqul tests in a category, shared by the help dialog and the public categories page so they
 * never disagree. Empty columns are left out.
 */
export function coverageColumns(info: CategoryInfo) {
  return [
    { title: 'Tests', note: 'Checked against Qloo, with a receipt', items: info.coverage.tests },
    {
      title: 'Also handles',
      note: 'Planned from the closest comps and tags when a title is new or niche',
      items: info.coverage.thin,
    },
    {
      title: 'You bring',
      note: 'Your own numbers, read beside the taste data',
      items: info.coverage.notSupported,
    },
  ].filter((c) => c.items.length);
}
