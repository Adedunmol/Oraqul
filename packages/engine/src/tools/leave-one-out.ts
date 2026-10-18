import type { Receipt } from '@oraqul/schema';
import type { ConfidenceInput } from '../confidence';
import { QlooBudgetError, QlooError } from '../qloo';
import { toReceipt } from '../receipts';
import type { ToolContext } from './tool';

// Spec §5.1: leave one out runs when 3 or more anchors are in the call.
const MIN_ANCHORS = 3;

export interface LeaveOneOut {
  /** Anchors whose absence moved a value the line used. All of them when the check did not run. */
  contributing: string[];
  check: ConfidenceInput['leaveOneOut'];
  receipts: Receipt[];
}

interface Rerun<T> {
  value: T;
  receipt: Receipt;
}

/**
 * Reruns the line's call once per anchor with that anchor left out, in parallel. `same` says
 * whether the line's answer held; `moved` whether any value it used changed.
 */
export async function leaveOneOut<T>(
  ctx: ToolContext,
  anchors: string[],
  full: T,
  rerun: (without: string[], left: string) => Promise<Rerun<T>>,
  compare: { same: (a: T, b: T) => boolean; moved: (a: T, b: T) => boolean },
): Promise<LeaveOneOut> {
  if (anchors.length < MIN_ANCHORS)
    return { contributing: anchors, check: undefined, receipts: [] };
  if (ctx.qloo.callsLeft < anchors.length) {
    return { contributing: anchors, check: { result: 'skipped' }, receipts: [] };
  }

  const settled = await Promise.allSettled(
    anchors.map((left) =>
      rerun(
        anchors.filter((a) => a !== left),
        left,
      ),
    ),
  );
  const receipts: Receipt[] = [];
  const runs: { left: string; value: T }[] = [];
  let failed = false;
  settled.forEach((outcome, i) => {
    const left = anchors[i] as string;
    if (outcome.status === 'fulfilled') {
      receipts.push(outcome.value.receipt);
      runs.push({ left, value: outcome.value.value });
      return;
    }
    failed = true;
    const err: unknown = outcome.reason;
    if (err instanceof QlooError) {
      receipts.push(
        toReceipt(err.call, {
          returned: err.call.returned,
          rule: `Could not test: the rerun without ${nameOf(ctx, left)} failed (${err.message}).`,
          confidence: 'lower',
          source: ctx.source,
        }),
      );
    } else if (!(err instanceof QlooBudgetError)) {
      throw err;
    }
  });
  if (failed) return { contributing: anchors, check: { result: 'skipped' }, receipts };

  const contributing = runs.filter((r) => compare.moved(full, r.value)).map((r) => r.left);
  const broke = runs.find((r) => !compare.same(full, r.value));
  const check: LeaveOneOut['check'] = broke
    ? { result: 'changes', restsOn: nameOf(ctx, broke.left) }
    : { result: 'holds' };
  return { contributing, check, receipts };
}

export function nameOf(ctx: ToolContext, entityId: string): string {
  return ctx.entities.get(entityId)?.name ?? entityId;
}
