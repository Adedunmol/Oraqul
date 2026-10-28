'use client';

import { Button } from '@oraqul/ui';

export default function DefaultsError({ retry }: { retry: () => void }) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-start gap-3">
      <h1 className="font-display text-2xl font-semibold">We could not load your team defaults.</h1>
      <p className="text-muted">Nothing was lost. Try again in a moment.</p>
      <Button variant="primary" icon="retry" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
