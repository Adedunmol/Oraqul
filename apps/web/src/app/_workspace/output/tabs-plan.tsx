'use client';

import type { LaunchPlan } from '@oraqul/schema';
import { useMemo } from 'react';
import { useOutputView } from './context';
import { PlanDocument } from './plan-document';

/** The launch plan page: the document, in a reading column. Evidence is one click behind it. */
export function LaunchPlanTab({ plan }: { plan: LaunchPlan }) {
  const { output, openReceipt } = useOutputView();
  const changes = useMemo(
    () => new Map(output.changes.map((c) => [c.lineId, c])),
    [output.changes],
  );
  return (
    <div className="max-w-[720px]">
      <PlanDocument plan={plan} changes={changes} onSource={(id) => openReceipt(id)} />
    </div>
  );
}
