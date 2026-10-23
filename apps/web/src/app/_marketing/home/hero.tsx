import { buttonClassName } from '@oraqul/ui';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { wrap } from '../section';
import { TasteDiscs } from '../taste-discs';
import { AppPreview } from './app-preview';
import { HeroOrbit } from './hero-orbit';

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Few words on purpose: the headline names the field and the promise. What the product is comes
 * from the art, the agent hub with the five kinds of media around it, and the light behind it.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip">
      <div
        aria-hidden="true"
        className="mk-sky pointer-events-none absolute inset-x-0 top-0 h-[78%]"
      />
      <div aria-hidden="true" className="scheme-dark absolute inset-x-0 bottom-0 h-[30%] bg-bg" />

      <div
        className={`${wrap} relative flex flex-col items-start gap-8 pt-[clamp(8px,10vw,160px)] pb-[clamp(56px,7vw,96px)]`}
      >
        <HeroOrbit />
        <h1
          id="hero-title"
          className="max-w-[14.5ch] font-display text-[clamp(44px,5.8vw,84px)] font-semibold leading-[0.98] tracking-[-0.05em] text-balance"
        >
          <span className="mk-word" style={at(0)}>
            Launch plans,
          </span>{' '}
          <span className="mk-word" style={at(90)}>
            with the <span className="text-accent">proof</span> attached.
          </span>
        </h1>

        <div className="mk-word" style={at(300)}>
          <p className="max-w-[44ch] text-balance text-[clamp(17px,1.5vw,20px)] leading-[1.5] text-ink/75">
            Launch plans grounded in what audiences actually like, for film, music, books, podcasts
            and games. One plan per territory, worked back from your date, with the Qloo taste data
            behind every claim.
          </p>
        </div>

        <div className="mk-word" style={at(420)}>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonClassName('primary')}>
              Create account
            </Link>
            <Link href="/examples" className={buttonClassName('default')}>
              See the examples
            </Link>
          </div>
        </div>
      </div>

      <div className={`${wrap} relative pb-[clamp(48px,7vw,96px)]`}>
        <TasteDiscs set="hero" />
        <div className="relative">
          <AppPreview />
        </div>
      </div>
    </section>
  );
}
