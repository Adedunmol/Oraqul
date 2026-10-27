'use client';

import { Button, Icon } from '@oraqul/ui';

// Keep in step with the inline script in app/layout.tsx that applies it before first paint.
const STORAGE_KEY = 'oraqul-theme';

export function toggleTheme() {
  const root = document.documentElement;
  const current =
    root.dataset.theme ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private windows can refuse storage. The choice then lasts until the page is closed.
  }
}

export function ThemeToggle() {
  return (
    <Button
      size="small"
      onClick={toggleTheme}
      aria-label="Light or dark"
      data-rail-tip="Light or dark"
      data-tip="Light or dark"
      className="size-8 p-0 rail:size-9"
    >
      <Icon name="theme" className="size-4" />
    </Button>
  );
}
