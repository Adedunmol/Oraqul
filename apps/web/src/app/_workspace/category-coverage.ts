import type { CategoryInfo } from '@oraqul/schema';

/**
 * What Oraqul tests in a category, in three columns: tested with a receipt, tested at lower
 * confidence, and what the team brings. Shared by the in app help dialog and the public
 * categories page, so they never disagree. Empty columns are left out.
 */
export function coverageColumns(info: CategoryInfo) {
  return [
    { title: 'Tests', note: 'Checked against Qloo, with a receipt', items: info.coverage.tests },
    {
      title: 'Less certain',
      note: 'Still tested, with lower confidence when there is little to go on',
      items: info.coverage.thin,
    },
    {
      title: 'You bring',
      note: 'Not in Qloo, so it is your numbers',
      items: info.coverage.notSupported,
    },
  ].filter((c) => c.items.length);
}
