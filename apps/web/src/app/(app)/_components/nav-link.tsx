'use client';

import { Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Shared by every sidebar item. In the rail the label hides and the count sits on the icon. */
export const navItemClass =
  'relative flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none rail:justify-center rail:px-0';
export const navItemActive = 'bg-accent-soft font-semibold text-accent';
export const navItemIdle = 'text-muted hover:bg-surface2 hover:text-ink';
export const navCountClass =
  'ml-auto rounded-full bg-surface2 px-1.5 text-[11px] font-semibold tabular-nums text-muted rail:absolute rail:top-0.5 rail:right-0.5 rail:ml-0 rail:min-w-4 rail:px-1 rail:text-center rail:text-[10px] rail:leading-4';

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
      data-rail-tip={children}
      className={`${navItemClass} ${active ? navItemActive : navItemIdle}`}
    >
      <Icon name={icon} />
      <span className="rail:sr-only">{children}</span>
      {badge ? (
        <span className={navCountClass}>
          {badge.value}
          <span className="sr-only"> {badge.label}</span>
        </span>
      ) : null}
    </Link>
  );
}
