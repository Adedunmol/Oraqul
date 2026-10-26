import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';
import { wrap } from '../section';
import { HeroArt } from './hero-art';
import { HeroPrompt } from './hero-prompt';
import { ProductChat } from './product-chat';
import { UseCaseTyper } from './use-case-typer';

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

const kinds = [
  ['film', 'Film and series'],
  ['music', 'Music'],
  ['books', 'Books'],
  ['podcasts', 'Podcasts'],
  ['games', 'Games'],
  ['shows', 'Live shows'],
] as const;

/**
 * The hero says what the product is before anything else, an AI launch planning agent for media
 * and entertainment, and then shows it: the real chat and plan, rising out of the page. There is
 * no illustration to decode.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="scheme-dark relative overflow-x-clip bg-bg">
      <div aria-hidden="true" className="mk-hero-glow pointer-events-none absolute inset-0" />
      <div
        className={`${wrap} relative flex flex-col items-center pt-[clamp(56px,9vw,128px)] text-center`}
      >
        <h1
          id="hero-title"
          className="max-w-[17ch] font-display text-[clamp(36px,5.8vw,88px)] leading-[1.02] font-medium tracking-[-0.045em] [font-stretch:110%] text-balance"
        >
          <span className="mk-word" style={at(0)}>
            The AI agent for launch planning in{' '}
          </span>
          <span className="mk-word text-accent" style={at(110)}>
            media &amp; entertainment.
          </span>
        </h1>
        <div className="mk-rise mt-[clamp(22px,2.8vw,36px)] w-full" style={at(260)}>
          <UseCaseTyper />
        </div>
        <div
          className="mk-rise mt-[clamp(28px,3.4vw,44px)] flex w-full flex-col items-center gap-6"
          style={at(380)}
        >
          <HeroPrompt />
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13.5px] text-muted">
            {kinds.map(([cat, label]) => (
              <li key={cat} data-cat={cat} className="flex items-center gap-1.5">
                <Icon name={cat} className="size-3.5 text-cat" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`${wrap} relative mt-[clamp(88px,12vw,190px)]`}>
        <HeroArt />
        <div
          className="mk-hero-rise relative z-10 mk-fade-out mx-auto h-[clamp(470px,52vw,640px)] w-full max-w-[1100px] overflow-hidden"
          style={at(560)}
        >
          <ProductChat className="h-[clamp(640px,64vw,760px)] border border-line" />
        </div>
      </div>
    </section>
  );
}
