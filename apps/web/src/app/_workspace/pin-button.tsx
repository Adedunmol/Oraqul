'use client';

import { Icon } from '@oraqul/ui';
import { togglePin, usePinnedProjects } from '@/lib/demo/pins';
import { toast } from './toast';

/** Pins a project to the top of the project lists, or takes it off. */
export function PinButton({
  projectId,
  name,
  reveal,
  className,
}: {
  projectId: string;
  name: string;
  /**
   * Hide until the surrounding `group` is hovered or holds focus. A pinned project keeps its pin
   * showing, as its state, and screens without hover always show it.
   */
  reveal?: boolean;
  className?: string;
}) {
  const pinned = usePinnedProjects().includes(projectId);
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
      onClick={(event) => {
        // The pin sits on a card whose link covers it; the pin must not open the card.
        event.preventDefault();
        event.stopPropagation();
        toast(togglePin(projectId) ? `${name} pinned` : `${name} unpinned`);
      }}
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-[color,background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${pinned ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'} ${hidden} ${className ?? ''}`}
    >
      <Icon name="pin" filled={pinned} className="size-4" />
    </button>
  );
}
