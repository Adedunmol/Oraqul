export default function Loading() {
  return (
    <div
      className="flex w-full max-w-2xl flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading settings"
    >
      <div className="flex flex-col gap-3">
        <div className="h-9 w-40 rounded-md bg-surface2 motion-safe:animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded-md bg-surface2 motion-safe:animate-pulse" />
      </div>
      <div className="h-64 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
      <div className="h-72 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
    </div>
  );
}
