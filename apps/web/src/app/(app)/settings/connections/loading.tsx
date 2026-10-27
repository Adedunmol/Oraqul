export default function Loading() {
  return (
    <div
      className="flex w-full max-w-2xl flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading connections"
    >
      <div className="h-9 w-48 rounded-md bg-surface2 motion-safe:animate-pulse" />
      <div className="h-48 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
      <div className="h-40 rounded-2xl bg-surface2 motion-safe:animate-pulse" />
    </div>
  );
}
