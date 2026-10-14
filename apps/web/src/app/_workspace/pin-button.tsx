'use client';

import { Icon } from '@oraqul/ui';
import { togglePin, usePinnedProjects } from '@/lib/demo/pins';
import { toast } from './toast';

/** Pins a project to the top of the project lists, or takes it off. */
export function PinButton({
  projectId,
  name,
  className,
}: {
  projectId: string;
  name: string;
  className?: string;
}) {
  const pinned = usePinnedProjects().includes(projectId);
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
      className={`grid size-8 shrink-0 place-items-center rounded-[10px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${pinned ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'} ${className ?? ''}`}
    >
      <Icon name="pin" className={`size-4 ${pinned ? '[&_path:first-child]:fill-current' : ''}`} />
    </button>
  );
}
