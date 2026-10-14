'use client';

import type { LineChange, Output, Receipt } from '@oraqul/schema';
import { createContext, use } from 'react';

export interface OutputView {
  output: Output;
  receipt: (lineId: string) => Receipt | undefined;
  change: (lineId: string) => LineChange | undefined;
  openReceipt: (lineId: string) => void;
  openExport: () => void;
  goToTab: (key: Output['tabs'][number]['key']) => void;
  /** The output this one was built on, for "open that evidence". */
  builtOn: { id: string; label: string } | undefined;
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
