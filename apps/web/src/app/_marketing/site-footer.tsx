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
      { href: '/guide', label: 'Guide' },
      { href: '/method', label: 'Method' },
      { href: '/trust', label: 'Trust' },
      { href: '/developers', label: 'Developers' },
      { href: 'https://github.com/Adedunmol/Oraqul', label: 'Source code' },
    ],
  },
  { title: 'Company', links: [{ href: '/about', label: 'About' }] },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
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
            An AI agent that plans launches for media and entertainment, grounded in what audiences
            actually like. Taste data from Qloo. Built for the Qloo Hackathon 2026.
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
        <p>
          Examples on this site use invented titles. Plans in the app are built on live Qloo taste
          data.
        </p>
      </div>
    </footer>
  );
}
