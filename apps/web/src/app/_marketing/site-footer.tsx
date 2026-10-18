import { Logo } from '@oraqul/ui';
import Link from 'next/link';
import { wrap } from './section';

const columns = [
  {
    title: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/examples', label: 'Examples' },
      { href: '/use-cases', label: 'Use cases' },
      { href: '/categories', label: 'Categories' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/method', label: 'Method' },
      { href: '/trust', label: 'Trust' },
    ],
  },
  { title: 'Company', links: [{ href: '/about', label: 'About' }] },
  { title: 'Legal', links: [{ href: '/privacy', label: 'Privacy' }] },
];

export function SiteFooter() {
  return (
    <footer className="scheme-dark bg-bg">
      <div
        className={`${wrap} grid grid-cols-2 gap-x-6 gap-y-10 py-12 min-[700px]:grid-cols-[1.4fr_repeat(4,1fr)]`}
      >
        <div className="col-span-2 flex max-w-xs flex-col gap-3 min-[700px]:col-span-1">
          <Logo />
          <p className="text-[13.5px] text-muted">
            A culturally grounded launch agent for media and entertainment. Launch plans grounded in
            what audiences actually like, from Qloo taste data.
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2.5">
            <h2 className="text-[14px] font-semibold text-ink">{column.title}</h2>
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={`${wrap} pb-8 text-[12.5px] text-muted`}>
        <p>Examples on this site use invented data. Nothing on it comes from Qloo.</p>
      </div>
    </footer>
  );
}
