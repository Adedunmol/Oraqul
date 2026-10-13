import { Suspense } from 'react';
import { ProductPreview } from './_components/product-preview';
import { SignInPanel } from './_components/sign-in-panel';

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 lg:grid-cols-2 lg:items-start lg:py-20">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Oraqul</p>
          <h1 className="font-display text-[clamp(26px,3vw,34px)] font-medium leading-[1.1] tracking-[-0.015em] text-balance">
            Launch strategy you can check, line by line.
          </h1>
          <p className="max-w-md text-muted">
            Every claim comes with a receipt from real audience taste data, so you can see why it
            holds, or why it does not.
          </p>
        </div>
        <ProductPreview />
      </div>
      <Suspense
        fallback={
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading sign in"
            className="h-96 rounded-2xl border border-line bg-surface2 motion-safe:animate-pulse"
          />
        }
      >
        <SignInPanel />
      </Suspense>
    </main>
  );
}
