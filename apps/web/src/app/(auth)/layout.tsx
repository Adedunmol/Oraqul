import { Logo } from '@oraqul/ui';
import Link from 'next/link';
import { type ReactNode, Suspense } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link
          href="/"
          aria-label="Oraqul home"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo />
        </Link>
        <Link
          href="/"
          className="rounded-md text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          Back to home
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        {/* The forms read the URL, so they wait inside a boundary. */}
        <Suspense
          fallback={
            <div
              role="status"
              aria-busy="true"
              aria-label="Loading"
              className="h-96 rounded-2xl bg-surface2 motion-safe:animate-pulse"
            />
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
