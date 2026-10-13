export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-16"
      aria-busy="true"
      aria-label="Loading invite"
    >
      <div className="h-3 w-12 rounded-md bg-surface2 motion-safe:animate-pulse" />
      <div className="h-48 rounded-2xl border border-line bg-surface2 motion-safe:animate-pulse" />
    </main>
  );
}
