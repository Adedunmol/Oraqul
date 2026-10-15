import { buttonClassName } from '@oraqul/ui';
import Link from 'next/link';

export default function InviteNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-5 py-16">
      <h1 className="font-display text-2xl font-semibold">This invite link is not valid.</h1>
      <p className="text-muted">Check that you opened the whole link, or ask for a new invite.</p>
      <Link href="/team" className={buttonClassName('primary')}>
        Go to your team
      </Link>
    </main>
  );
}
