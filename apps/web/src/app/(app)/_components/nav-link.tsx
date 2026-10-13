'use client';

import { Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: IconName;
  /** A count shown on the right. `label` says what is counted, for screen readers. */
  badge?: { value: number; label: string };
  children: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 items-center gap-2.5 rounded-[10px] border px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${active ? 'border-line bg-surface font-semibold text-ink' : 'border-transparent text-muted hover:bg-surface2 hover:text-ink'}`}
    >
      <Icon name={icon} />
      {children}
      {badge ? (
        <span className="ml-auto rounded-md bg-surface2 px-1.5 text-[11px] font-semibold tabular-nums text-muted">
          {badge.value}
          <span className="sr-only"> {badge.label}</span>
        </span>
      ) : null}
    </Link>
  );
}
