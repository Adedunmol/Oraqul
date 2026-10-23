'use client';

import { Button, Icon } from '@oraqul/ui';
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
  { href: '/guide', label: 'Guide' },
];

const linkClass =
  'rounded-md px-2.5 py-1.5 text-[13.5px] text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink motion-reduce:transition-none';

/** Both menus close on Escape, and focus returns to the button that opened them. */
export function NavMenu({ extra }: { extra: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<'product' | 'menu' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const productButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new path closes whatever is open
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  // The sheet is a modal dialog: the browser owns Escape and the top layer, so only the page's
  // scroll needs holding still here.
  useEffect(() => {
    if (open !== 'menu') return;
    sheet.current?.showModal();
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    if (open !== 'product') return;
    const close = (returnFocus: boolean) => {
      setOpen(null);
      if (returnFocus) productButton.current?.focus();
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

  // A page under a link, such as an open example, still lights that link.
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const productActive = product.some((item) => isActive(item.href));
  const current = (href: string) => (isActive(href) ? 'page' : undefined);

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
                    className="group flex flex-col rounded-lg px-3 py-2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent aria-[current=page]:bg-accent-soft"
                  >
                    <span className="text-[13.5px] font-medium group-aria-[current=page]:font-semibold group-aria-[current=page]:text-accent">
                      {item.label}
                    </span>
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

      <Button
        ref={menuButton}
        variant="ghost"
        icon="menu"
        aria-label="Open menu"
        aria-expanded={open === 'menu'}
        aria-controls="mobile-menu"
        onClick={() => setOpen('menu')}
        className="min-[900px]:hidden"
      />
      {open === 'menu' ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the dim is a mouse shortcut; Escape and the close icon are the keyboard ways out
        <dialog
          ref={sheet}
          id="mobile-menu"
          aria-label="Main menu"
          onClose={() => {
            setOpen(null);
            menuButton.current?.focus();
          }}
          onClick={(e) => {
            if (e.target === sheet.current) sheet.current?.close();
          }}
          className="mk-sheet m-0 ml-auto h-dvh max-h-none w-[min(88vw,22rem)] max-w-none bg-bg p-0 text-ink shadow-md min-[900px]:hidden"
        >
          <div className="flex h-full flex-col gap-1 overflow-y-auto p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="px-3 text-[13px] font-medium text-muted">Menu</span>
              <Button
                variant="ghost"
                icon="close"
                aria-label="Close menu"
                onClick={() => sheet.current?.close()}
              />
            </div>
            <nav aria-label="Main" className="flex flex-col gap-1">
              {[...product, ...top].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current(item.href)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-[16px] hover:bg-surface2 aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent"
                >
                  {item.label}
                </Link>
              ))}
              {extra}
            </nav>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
