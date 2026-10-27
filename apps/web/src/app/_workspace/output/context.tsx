'use client';

import type {
  CampaignState,
  LineChange,
  Output,
  ReactionKind,
  Receipt,
  WatchState,
} from '@oraqul/schema';
import { createContext, use } from 'react';

export interface OutputView {
  output: Output;
  receipt: (lineId: string) => Receipt | undefined;
  change: (lineId: string) => LineChange | undefined;
  /** `ids` shows the call id and endpoint: only the Evidence tab asks for them (PRD E2). */
  openReceipt: (lineId: string, options?: { ids?: boolean }) => void;
  goToTab: (key: Output['tabs'][number]['key']) => void;
  /** The output this one was built on, for "open that evidence". */
  builtOn: { id: string; label: string } | undefined;
  /** The caller's own rating of the plan. Null when there is none, and on a shared link. */
  reaction: ReactionKind | null;
  /** The plan's campaign. Null when the output has none, and on a shared link. */
  campaign: CampaignState | null;
  /** The plan's watch and pace. Null when the output has none, and on a shared link without a sample. */
  watch: WatchState | null;
  /** False for viewers and on a shared link. */
  canEdit: boolean;
  shared: boolean;
}

export const OutputContext = createContext<OutputView | null>(null);

export function useOutputView(): OutputView {
  const view = use(OutputContext);
  if (!view) throw new Error('useOutputView must be used inside an OutputContext provider');
  return view;
}

export function makeView(
  output: Output,
  rest: Omit<OutputView, 'output' | 'receipt' | 'change'>,
): OutputView {
  const receipts = new Map(output.receipts.map((r) => [r.lineId ?? '', r]));
  const changes = new Map(output.changes.map((c) => [c.lineId, c]));
  return {
    output,
    receipt: (id) => receipts.get(id),
    change: (id) => changes.get(id),
    ...rest,
  };
}
