'use client';

import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';

const product = [
  { href: '/how-it-works', label: 'How it works', note: 'From one message to a plan' },
  { href: '/examples', label: 'Examples', note: 'Three launches, every receipt open' },
  { href: '/method', label: 'Method', note: 'How verdicts and scores are computed' },
];

const top = [
  { href: '/use-cases', label: 'Use cases' },
  { href: '/categories', label: 'Categories' },
];

const linkClass =
  'rounded-md px-2.5 py-1.5 text-[13.5px] text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink motion-reduce:transition-none';

/**
 * The header's links. A Product menu on a wide screen and one Menu panel below 900px, both closed
 * by Escape or a click outside, with focus returned to the button that opened them.
 */
export function NavMenu({ extra }: { extra: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<'product' | 'menu' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const productButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new path closes whatever is open
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (returnFocus: boolean) => {
      const button = open === 'product' ? productButton.current : menuButton.current;
      setOpen(null);
      if (returnFocus) button?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const productActive = product.some((item) => pathname === item.href);
  const current = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <div ref={root} className="flex flex-1 items-center justify-end min-[900px]:justify-start">
      <nav aria-label="Main" className="relative hidden items-center gap-0.5 min-[900px]:flex">
        <div className="relative">
          <button
            ref={productButton}
            type="button"
            aria-expanded={open === 'product'}
            aria-controls="product-menu"
            onClick={() => setOpen(open === 'product' ? null : 'product')}
            className={`${linkClass} inline-flex items-center gap-1 ${productActive ? 'font-semibold text-ink' : ''}`}
          >
            Product
            <Icon
              name="chevron"
              className={`size-3.5 transition-transform duration-150 motion-reduce:transition-none ${open === 'product' ? 'rotate-180' : ''}`}
            />
          </button>
          {open === 'product' ? (
            <ul
              id="product-menu"
              className="absolute top-full left-0 z-20 mt-2 flex w-72 flex-col gap-0.5 rounded-xl bg-surface p-1.5 shadow-md ring-1 ring-line"
            >
              {product.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current(item.href)}
                    className="flex flex-col rounded-lg px-3 py-2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span className="text-[13.5px] font-medium">{item.label}</span>
                    <span className="text-[12.5px] text-muted">{item.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {top.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current(item.href)}
            className={linkClass}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        ref={menuButton}
        type="button"
        aria-expanded={open === 'menu'}
        aria-controls="mobile-menu"
        onClick={() => setOpen(open === 'menu' ? null : 'menu')}
        className="inline-flex h-10 items-center rounded-lg px-3 text-[13.5px] font-medium hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent min-[900px]:hidden"
      >
        {open === 'menu' ? 'Close' : 'Menu'}
      </button>
      {open === 'menu' ? (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="absolute inset-x-0 top-full z-20 flex flex-col gap-1 bg-bg px-[clamp(16px,2.4vw,32px)] pt-2 pb-5 shadow-md min-[900px]:hidden"
        >
          {[...product, ...top].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current(item.href)}
              className="flex min-h-11 items-center rounded-lg px-3 text-[16px] hover:bg-surface2 aria-[current=page]:font-semibold"
            >
              {item.label}
            </Link>
          ))}
          {extra}
        </nav>
      ) : null}
    </div>
  );
}
