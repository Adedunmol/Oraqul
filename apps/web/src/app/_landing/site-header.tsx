import { meResponseSchema } from '@oraqul/schema';
import { buttonClassName, Logo } from '@oraqul/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { serverGetIfSignedIn } from '@/lib/api/server';
import { overviewPath } from '@/lib/routes';

const navLink =
  'rounded-md px-2 py-1 text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent';

function SignedOutActions() {
  return (
    <>
      <Link href="/sign-in" className={buttonClassName('ghost', 'small')}>
        Sign in
      </Link>
      <Link href="/sign-up" className={buttonClassName('primary', 'small')}>
        Create account
      </Link>
    </>
  );
}

// A failed lookup shows the signed out buttons: the landing page works with the API down.
async function HeaderActions() {
  const me = await serverGetIfSignedIn('/auth/me', meResponseSchema).catch(() => undefined);
  if (!me) return <SignedOutActions />;
  return (
    <Link href={overviewPath} className={buttonClassName('primary', 'small')}>
      Open app
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href="/"
          aria-label="Oraqul home"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 min-[700px]:flex">
          <a href="#how" className={navLink}>
            How it works
          </a>
          <a href="#categories" className={navLink}>
            Categories
          </a>
          <a href="#receipts" className={navLink}>
            Receipts
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Suspense fallback={<SignedOutActions />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
