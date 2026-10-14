'use client';

import { Button, Icon } from '@oraqul/ui';
import { type ReactNode, useEffect, useId, useRef } from 'react';

// Lives here, not in packages/ui: that package is one bundle with no client entry, so a component
// that uses hooks would break the server components that import Button from it.
export function Modal({
  open,
  onClose,
  title,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** For previews that need room, such as the export brief. */
  wide?: boolean;
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
      className={`m-auto max-h-[calc(100dvh-32px)] overflow-y-auto ${wide ? 'w-[min(92vw,820px)]' : 'w-[min(92vw,26rem)]'} pop-in rounded-2xl border border-line bg-canvas p-6 text-ink shadow-[var(--shadow)]`}
    >
      {open ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            <Button size="small" variant="ghost" onClick={onClose} aria-label="Close">
              <Icon name="close" className="size-4" />
            </Button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
