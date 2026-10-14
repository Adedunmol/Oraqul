import { meResponseSchema } from '@oraqul/schema';
import { buttonClassName, Logo } from '@oraqul/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { serverGetIfSignedIn } from '@/lib/api/server';
import { overviewPath } from '@/lib/routes';
import { NavMenu } from './nav-menu';
import { wrap } from './section';

// A failed lookup reads as signed out: the public pages work with the API down.
async function signedIn(): Promise<boolean> {
  const me = await serverGetIfSignedIn('/auth/me', meResponseSchema).catch(() => undefined);
  return Boolean(me);
}

function SignedOutActions() {
  return (
    <>
      <Link href="/sign-in" className={`${buttonClassName('ghost', 'small')} max-[599px]:hidden`}>
        Sign in
      </Link>
      <Link href="/sign-up" className={buttonClassName('primary', 'small')}>
        Create account
      </Link>
    </>
  );
}

async function HeaderActions() {
  if (!(await signedIn())) return <SignedOutActions />;
  return (
    <Link href={overviewPath} className={buttonClassName('primary', 'small')}>
      Open app
    </Link>
  );
}

// Sign in is hidden from the bar below 600px to keep one row, so the Menu panel carries it.
async function MobileExtra() {
  if (await signedIn()) return null;
  return (
    <Link
      href="/sign-in"
      className="flex min-h-11 items-center rounded-lg px-3 text-[16px] hover:bg-surface2 min-[600px]:hidden"
    >
      Sign in
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur">
      <div className={`${wrap} relative flex items-center gap-4 py-3`}>
        <Link
          href="/"
          aria-label="Oraqul home"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo />
        </Link>
        <NavMenu
          extra={
            <Suspense fallback={null}>
              <MobileExtra />
            </Suspense>
          }
        />
        <div className="flex items-center gap-2">
          <Suspense fallback={<SignedOutActions />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
