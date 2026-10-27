'use client';

import { Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/lib/api/auth';
import { toggleTheme } from './theme-toggle';

const item =
  'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none';

/** The person at the foot of the sidebar. It holds the things used rarely: settings, theme, sign out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  async function signOut() {
    setLeaving(true);
    try {
      await logout();
      router.push('/');
      router.refresh();
    } finally {
      setLeaving(false);
    }
  }

  const row = (icon: IconName, label: string) => (
    <>
      <Icon name={icon} className="size-4 text-muted" />
      {label}
    </>
  );

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-rail-tip={`${name}, ${email}`}
        className="flex w-full min-w-0 items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none rail:justify-center"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-ink"
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col rail:sr-only">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-[13px] text-muted">{email}</span>
        </span>
        <Icon name="chevron" className="text-muted rail:hidden" />
      </button>

      {open ? (
        <div className="absolute inset-x-0 bottom-full z-20 mb-1 flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow)] rail:right-auto rail:w-56">
          <Link href="/settings" onClick={() => setOpen(false)} className={item}>
            {row('settings', 'Settings')}
          </Link>
          <button type="button" onClick={toggleTheme} className={item}>
            {row('theme', 'Light or dark')}
          </button>
          <button type="button" onClick={signOut} disabled={leaving} className={item}>
            {row('signout', leaving ? 'Signing out' : 'Sign out')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
