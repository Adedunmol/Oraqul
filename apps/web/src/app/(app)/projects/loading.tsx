export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-16"
      aria-busy="true"
      aria-label="Loading projects"
    >
      <div className="h-9 w-40 rounded-md bg-surface2 motion-safe:animate-pulse" />
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="h-20 rounded-lg border border-line bg-surface2 motion-safe:animate-pulse"
        />
      ))}
    </main>
  );
}
