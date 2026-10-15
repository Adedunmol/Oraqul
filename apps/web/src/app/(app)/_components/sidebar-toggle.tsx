'use client';

import { Icon } from '@oraqul/ui';
import { useEffect, useState } from 'react';

// Keep in step with the inline script in app/layout.tsx that applies it before first paint.
const STORAGE_KEY = 'oraqul-sidebar';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Sets the choice on the page and remembers it. Returns whether the sidebar is now collapsed. */
function apply(next: boolean): boolean {
  const root = document.documentElement;
  if (next) root.dataset.sidebar = 'collapsed';
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'open');
  } catch {
    // Private windows can refuse storage. The choice then lasts until the page is closed.
  }
  return next;
}

/** Collapses the sidebar to an icon rail and back. Also on ⌘B or Ctrl B outside a text field. */
export function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === 'collapsed');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'b' || !(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      setCollapsed(apply(document.documentElement.dataset.sidebar !== 'collapsed'));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <button
      type="button"
      onClick={() => setCollapsed(apply(!collapsed))}
      aria-label={label}
      aria-expanded={!collapsed}
      data-tip={`${label} (⌘B)`}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
    >
      <Icon name="sidebar" />
    </button>
  );
}
