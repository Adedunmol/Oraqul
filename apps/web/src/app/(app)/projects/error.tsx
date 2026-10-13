'use client';

export default function ProjectsError({ retry }: { retry: () => void }) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-start gap-3">
      <h1 className="font-display text-2xl font-medium">We could not load your projects.</h1>
      <p className="text-muted">Nothing was lost. Try again in a moment.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink"
      >
        Try again
      </button>
    </div>
  );
}
