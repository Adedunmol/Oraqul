import { meResponseSchema } from '@oraqul/schema';
import { buttonClassName, Logo } from '@oraqul/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { serverGetIfSignedIn } from '@/lib/api/server';
import { overviewPath } from '@/lib/routes';
import { HeaderShell } from './header-shell';
import { NavMenu } from './nav-menu';
import { wrap } from './section';

// A failed lookup reads as signed out: the public pages work with the API down.
async function signedIn(): Promise<boolean> {
  const me = await serverGetIfSignedIn('/auth/me', meResponseSchema).catch(() => undefined);
  return Boolean(me);
}

const menuButton = 'h-11 w-full text-[15px]';

// Below 900px the bar carries only the logo and the menu button; the account actions live in the sheet.
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

async function HeaderActions() {
  if (!(await signedIn())) return <SignedOutActions />;
  return (
    <Link href={overviewPath} className={buttonClassName('primary', 'small')}>
      Open app
    </Link>
  );
}

async function MobileExtra() {
  const actions = (await signedIn()) ? (
    <Link href={overviewPath} className={`${buttonClassName('primary')} ${menuButton}`}>
      Open app
    </Link>
  ) : (
    <>
      <Link href="/sign-up" className={`${buttonClassName('primary')} ${menuButton}`}>
        Create account
      </Link>
      <Link href="/sign-in" className={`${buttonClassName('default')} ${menuButton}`}>
        Sign in
      </Link>
    </>
  );
  return <div className="mt-4 flex flex-col gap-2.5 border-t border-line pt-5">{actions}</div>;
}

export function SiteHeader() {
  return (
    <HeaderShell>
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
        <div className="hidden items-center gap-2 min-[900px]:flex">
          <Suspense fallback={<SignedOutActions />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
    </HeaderShell>
  );
}
