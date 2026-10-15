'use client';

import { Button } from '@oraqul/ui';

export default function InviteError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-5 py-16">
      <h1 className="font-display text-2xl font-semibold">We could not open this invite.</h1>
      <p className="text-muted">The invite is still valid. Try again in a moment.</p>
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
