export default function Loading() {
  return (
    <div
      className="flex w-full max-w-5xl flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading team defaults"
    >
      <div className="flex flex-col gap-3">
        <div className="h-9 w-56 rounded-md bg-surface2 motion-safe:animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded-md bg-surface2 motion-safe:animate-pulse" />
      </div>
      <div className="h-56 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
      <div className="h-40 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
    </div>
  );
}
