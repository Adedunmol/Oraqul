import { Icon } from '@oraqul/ui';
import Link from 'next/link';

export interface Crumb {
  label: string;
  /** Left out for the current page, which shows as plain text. */
  href?: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="-ml-1 flex flex-wrap items-center gap-1 text-[13px] text-muted">
        {items.map((c, i) => (
          <li key={c.label + (c.href ?? '')} className="inline-flex min-w-0 items-center gap-1">
            {c.href ? (
              <Link
                href={c.href}
                className="rounded-[6px] px-1 py-0.5 transition-colors duration-150 hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="min-w-0 truncate px-1 text-ink">
                {c.label}
              </span>
            )}
            {i < items.length - 1 ? (
              <Icon name="chevron" className="size-3.5 shrink-0 -rotate-90 opacity-60" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
