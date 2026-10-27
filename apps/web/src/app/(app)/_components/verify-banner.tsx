import { buttonClassName, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { getShellData } from '@/lib/api/shell';
import { ResendVerification } from '../../_components/resend-verification';

/** Shown above every page until the address is confirmed. The pages stay readable meanwhile. */
export async function VerifyBanner() {
  const data = await getShellData();
  if (!data || data.user.emailVerified) return null;
  return (
    <section
      aria-label="Confirm your email"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-surface2 px-4 py-3"
    >
      <p className="flex min-w-0 items-start gap-2.5 text-sm">
        <Icon name="warning" className="mt-0.5 size-4 text-muted" />
        <span>
          <strong className="font-semibold">
            Confirm your email to start projects and send messages.
          </strong>{' '}
          <span className="text-muted">We sent a link to {data.user.email}.</span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <ResendVerification />
        <Link href="/verify" className={buttonClassName('primary', 'small')}>
          Enter code
        </Link>
      </div>
    </section>
  );
}
