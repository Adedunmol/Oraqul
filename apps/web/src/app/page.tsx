import { buttonClassName } from '@oraqul/ui';
import Link from 'next/link';
import { ExampleAnswer } from './_landing/example-answer';
import { Categories, ClosingCta, HowItWorks, Receipts } from './_landing/sections';
import { SiteFooter } from './_landing/site-footer';
import { SiteHeader } from './_landing/site-header';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-14 min-[900px]:grid-cols-2 min-[900px]:items-center min-[900px]:py-20"
        >
          <div className="flex flex-col items-start gap-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Launch strategy for film, music, books, podcasts and games
            </p>
            <h1
              id="hero-title"
              className="font-display text-[clamp(34px,5vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-balance"
            >
              Launch strategy you can check, line by line.
            </h1>
            <p className="max-w-md text-[16px] text-muted">
              Oraqul plans your launch, checks the plan you have and rescues one that missed. Every
              claim comes with a receipt from real audience taste data.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className={buttonClassName('primary')}>
                Create account
              </Link>
              <Link href="/sign-in" className={buttonClassName('default')}>
                Sign in
              </Link>
            </div>
          </div>
          <ExampleAnswer />
        </section>
        <HowItWorks />
        <Categories />
        <Receipts />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
