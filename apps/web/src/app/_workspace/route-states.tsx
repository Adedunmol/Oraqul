'use client';

import { Button } from '@oraqul/ui';

/** Skeleton shaped like a page head, tabs and a few cards, so the page does not jump. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex w-full flex-col gap-6" role="status" aria-busy="true" aria-label={label}>
      <div className="h-8 rounded-xl bg-surface2 motion-safe:animate-pulse" />
      <div className="h-9 w-56 rounded-md bg-surface2 motion-safe:animate-pulse" />
      <div className="h-10 w-80 max-w-full rounded-xl bg-surface2 motion-safe:animate-pulse" />
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-24 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export function PageError({ what, retry }: { what: string; retry: () => void }) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-start gap-3">
      <h1 className="font-display text-2xl font-semibold">We could not load {what}.</h1>
      <p className="text-muted">Nothing was lost. Try again in a moment.</p>
      <Button variant="primary" icon="retry" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
