import { buttonClassName, Icon, Logo } from '@oraqul/ui';
import Link from 'next/link';
import { type ReactNode, Suspense } from 'react';
import '../_marketing/marketing.css';
import { AuthAside } from './_components/auth-aside';

// Pinned light like the marketing pages, with the dark brand panel beside the form on wide screens.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="scheme-light min-h-dvh bg-canvas min-[1000px]:grid min-[1000px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <AuthAside />
      <div className="flex min-h-dvh flex-col">
        <header className="flex w-full items-center justify-between px-[clamp(20px,2.4vw,32px)] py-4 min-[1000px]:justify-end">
          <Link
            href="/"
            aria-label="Oraqul home"
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent min-[1000px]:hidden"
          >
            <Logo />
          </Link>
          <Link href="/" className={buttonClassName('default', 'small', 'icon')}>
            <Icon name="home" className="size-4" />
            Back to home
          </Link>
        </header>
        <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-[clamp(20px,2.4vw,32px)] pb-16">
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
    </div>
  );
}
