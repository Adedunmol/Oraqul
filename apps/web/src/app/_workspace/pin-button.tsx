'use client';

import { Icon } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setPinned } from '@/lib/api/projects';
import { toast } from './toast';

export function PinButton({
  projectId,
  name,
  pinned,
  reveal,
  className,
}: {
  projectId: string;
  name: string;
  pinned: boolean;
  /**
   * Hide until the surrounding `group` is hovered or holds focus. A pinned project keeps its pin
   * showing, as its state, and screens without hover always show it.
   */
  reveal?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Opacity, not display, so the button stays in the tab order and focus reveals it.
  const hidden =
    reveal && !pinned
      ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
      : '';
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
      data-tip={pinned ? 'Unpin' : 'Pin to the top'}
      disabled={busy}
      onClick={async (event) => {
        // The pin sits on a card whose link covers it; the pin must not open the card.
        event.preventDefault();
        event.stopPropagation();
        setBusy(true);
        try {
          await setPinned(projectId, !pinned);
          toast(pinned ? `${name} unpinned` : `${name} pinned`);
          router.refresh();
        } catch {
          toast(`Could not ${pinned ? 'unpin' : 'pin'} ${name}. Try again.`);
        } finally {
          setBusy(false);
        }
      }}
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-[color,background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${pinned ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'} ${hidden} ${className ?? ''}`}
    >
      <Icon name="pin" filled={pinned} className="size-4" />
    </button>
  );
}
