import type { CSSProperties } from 'react';
import { wrap } from '../section';
import { HeroOrbit } from './hero-orbit';
import { HeroPrompt } from './hero-prompt';

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Few words on purpose: the headline names the promise, one lead line names the product, and the
 * message box is the way in. What the product is comes from the art: the agent hub with the five
 * kinds of media around it, faint and wordless. The app preview has its own band under it.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="scheme-dark relative flex min-h-[min(100svh,980px)] flex-col justify-center overflow-x-clip bg-bg"
    >
      <div aria-hidden="true" className="mk-sky pointer-events-none absolute inset-0" />

      <div className={`${wrap} relative flex flex-col items-start py-[clamp(88px,13vw,220px)]`}>
        <HeroOrbit />
        <h1
          id="hero-title"
          className="max-w-[13ch] font-display text-[clamp(40px,5.8vw,84px)] font-semibold leading-[0.98] tracking-[-0.05em] text-balance"
        >
          <span className="mk-word" style={at(0)}>
            Plan your launch for the
          </span>{' '}
          <span className="mk-word text-accent" style={at(90)}>
            right audience.
          </span>
        </h1>

        <div className="mk-word mt-[clamp(20px,2.4vw,32px)]" style={at(300)}>
          <p className="max-w-[44ch] text-balance text-[clamp(17px,1.5vw,20px)] leading-[1.5] text-ink/75">
            An AI agent that works out who your launch is for and where, grounded in real audience
            taste data.
          </p>
        </div>

        <div className="mk-word mt-[clamp(36px,4.6vw,64px)] w-full" style={at(420)}>
          <HeroPrompt />
        </div>
      </div>
    </section>
  );
}
