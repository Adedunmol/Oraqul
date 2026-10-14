'use client';

import type { Output } from '@oraqul/schema';
import { Button, Icon, VerdictPill } from '@oraqul/ui';
import { useEffect, useId, useRef } from 'react';

/** Display name of a line, from whichever brief group holds it. */
export function lineLabel(output: Output, lineId: string): string {
  const b = output.brief;
  const assumption = b.assumptions.find((x) => x.id === lineId);
  if (assumption) return assumption.text;
  const date = b.dates.find((x) => x.id === lineId);
  if (date) return `${date.date} vs ${date.rival}`;
  const named = [
    ...b.audience,
    ...b.s1,
    ...b.s2,
    ...b.s3,
    ...b.s4,
    ...b.places,
    ...b.partners,
    ...(b.shelf ?? []),
    ...(b.bridge ?? []),
    ...(b.topics ?? []),
    ...(b.fan ?? []),
    ...(b.grid?.rows ?? []),
  ].find((x) => x.id === lineId);
  return named?.name ?? lineId;
}

const confidenceText = { high: 'High', medium: 'Medium', lower: 'Lower, thin data' } as const;

/** The receipt behind one line, in a sheet from the right. design-system §7.17 */
export function ReceiptDrawer({
  output,
  lineId,
  onClose,
  publicExample = false,
}: {
  output: Output;
  lineId: string | null;
  onClose: () => void;
  /** On the public example page: no endpoint and no response shape, so nothing reads as raw Qloo data. */
  publicExample?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const receipt = lineId ? output.receipts.find((r) => r.lineId === lineId) : undefined;
  const verdict = lineId
    ? output.brief.assumptions.find((a) => a.id === lineId)?.verdict
    : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (receipt && !dialog.open) dialog.showModal();
    if (!receipt && dialog.open) dialog.close();
  }, [receipt]);

  const entities =
    receipt && Array.isArray(receipt.input.entities) ? receipt.input.entities.join(', ') : '';
  const returned = receipt && typeof receipt.returned === 'string' ? receipt.returned : '';

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a mouse shortcut; Esc and Close are the keyboard ways out
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="slide-in my-2.5 mr-2.5 ml-auto h-[calc(100dvh-20px)] max-h-none w-[min(calc(100%-20px),420px)] overflow-y-auto rounded-2xl border border-line bg-surface p-[22px] text-ink shadow-[var(--shadow)]"
    >
      {receipt && lineId ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Receipt
            </p>
            <Button size="small" variant="ghost" onClick={onClose} aria-label="Close">
              <Icon name="close" className="size-4" />
            </Button>
          </div>
          <h2 id={titleId} className="font-display text-xl font-semibold tracking-[-0.02em]">
            {lineLabel(output, lineId)}
          </h2>
          {verdict ? (
            <div>
              <VerdictPill verdict={verdict} />
            </div>
          ) : null}
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Call id</dt>
            <dd className="font-mono text-xs break-words">{receipt.callId}</dd>
            {publicExample ? null : (
              <>
                <dt className="text-muted">Endpoint</dt>
                <dd className="font-mono text-xs">{receipt.endpoint}</dd>
              </>
            )}
            <dt className="text-muted">Input</dt>
            <dd className="break-words">{entities}</dd>
            <dt className="text-muted">Returned</dt>
            <dd className="break-words">{returned}</dd>
            <dt className="text-muted">How it was decided</dt>
            <dd className="break-words">{receipt.rule}</dd>
            <dt className="text-muted">Confidence</dt>
            <dd>{confidenceText[receipt.confidence]}</dd>
          </dl>
          {publicExample ? null : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Example response shape
              </p>
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface2 px-3 py-2.5 font-mono text-xs">
                {JSON.stringify(
                  {
                    call: receipt.callId,
                    endpoint: receipt.endpoint,
                    input: receipt.input,
                    result: receipt.returned,
                  },
                  null,
                  2,
                )}
              </pre>
            </>
          )}
          <p className="text-xs text-muted">
            Sent to Qloo: public titles, names and places only. Your plan text and results never
            leave your team.
          </p>
          {receipt.source === 'demo' ? (
            <p className="text-xs text-muted">
              Demo receipt. In the real product this opens the actual Qloo call with its full
              response.
            </p>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
