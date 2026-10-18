import type { ToolContext } from '@oraqul/engine';
import type { QlooEntityType, Receipt } from '@oraqul/schema';
import { baselineFor as launchBaselineFor } from '../launch/baseline.js';

export { clearBaselineCache } from '../launch/baseline.js';

export const baselineFor = (
  ctx: ToolContext,
  keep: (made: Receipt[]) => void,
  type: QlooEntityType,
) => launchBaselineFor('film', ctx, keep, type);
