'use client';

import { Button } from '@oraqul/ui';

export default function TeamError({ retry }: { retry: () => void }) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-start gap-3">
      <h1 className="font-display text-2xl font-medium">We could not load your team.</h1>
      <p className="text-muted">Nothing was lost. Try again in a moment.</p>
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
