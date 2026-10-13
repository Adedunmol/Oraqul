'use client';

import { Button } from '@oraqul/ui';
import { type ReactNode, useEffect, useId, useRef } from 'react';

// Lives here, not in packages/ui: that package is one bundle with no client entry, so a component
// that uses hooks would break the server components that import Button from it.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a mouse shortcut; Esc and Close are the keyboard ways out
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-[18px] border border-line bg-surface p-5 text-ink shadow-[var(--shadow)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      {open ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            <Button size="small" onClick={onClose}>
              Close
            </Button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
