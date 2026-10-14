import { buttonClassName } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** The card every auth page sits in: a title, one sentence, the form, and the links to the other ways in. */
export function AuthCard({
  title,
  lead,
  children,
  links,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  links?: { href: string; label: string }[];
}) {
  return (
    <section
      aria-labelledby="auth-heading"
      className="flex w-full flex-col gap-5 rounded-2xl bg-surface p-6 sm:p-9"
    >
      <div className="flex flex-col gap-1.5">
        <h1
          id="auth-heading"
          className="font-display text-[clamp(26px,3vw,30px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance"
        >
          {title}
        </h1>
        {lead ? <p className="text-muted">{lead}</p> : null}
      </div>
      {children}
      {links ? (
        <nav aria-label="Other ways in" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md py-1 text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </section>
  );
}

export function GoogleButton({ href }: { href: string }) {
  return (
    <>
      <a href={href} className={`${buttonClassName('default')} w-full`}>
        Continue with Google
      </a>
      <p className="flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </p>
    </>
  );
}

export function FormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="text-[13px] text-breaks">
      {message}
    </p>
  ) : null;
}
