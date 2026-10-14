import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted"
    >
      {items.map((c, i) =>
        c.href && i < items.length - 1 ? (
          <span key={c.label + c.href} className="inline-flex items-center gap-1.5">
            <Link href={c.href} className="text-accent underline underline-offset-2">
              {c.label}
            </Link>
            <span aria-hidden="true" className="opacity-50">
              /
            </span>
          </span>
        ) : (
          <span key={c.label} aria-current="page" className="font-semibold text-ink">
            {c.label}
          </span>
        ),
      )}
    </nav>
  );
}
