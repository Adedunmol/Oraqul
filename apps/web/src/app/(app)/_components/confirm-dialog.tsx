'use client';

import { Button, Icon, type IconName } from '@oraqul/ui';
import type { ReactNode } from 'react';
import { Modal } from './modal';

/**
 * The one confirmation for any action that removes something or cannot be undone. Back is the
 * first button and the default way out, so the destructive choice is never the easy one. Say what
 * is lost in `children`, in plain words.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  confirmIcon = 'trash',
  onConfirm,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmIcon?: IconName;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-breaks-bg text-breaks"
        >
          <Icon name="warning" />
        </span>
        <div className="flex flex-col gap-2 pt-0.5 text-sm leading-[1.55] text-muted">
          {children}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button icon="back" onClick={onClose} disabled={pending}>
          Back
        </Button>
        <Button variant="dangerSolid" icon={confirmIcon} onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
