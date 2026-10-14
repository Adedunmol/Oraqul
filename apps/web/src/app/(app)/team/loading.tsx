export default function Loading() {
  return (
    <div
      className="flex w-full max-w-3xl flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading team"
    >
      <div className="flex flex-col gap-3">
        <div className="h-3 w-12 rounded-md bg-surface2 motion-safe:animate-pulse" />
        <div className="h-9 w-56 rounded-md bg-surface2 motion-safe:animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded-md bg-surface2 motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 rounded-md bg-surface2 motion-safe:animate-pulse" />
        <div className="h-48 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-3 w-28 rounded-md bg-surface2 motion-safe:animate-pulse" />
        <div className="h-40 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
