import { Logo } from '@oraqul/ui';
import Link from 'next/link';

const links = [
  { href: '/sign-in', label: 'Sign in' },
  { href: '/sign-up', label: 'Create account' },
  { href: '#how', label: 'How it works' },
  { href: '#categories', label: 'Categories' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8">
        <Logo />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
