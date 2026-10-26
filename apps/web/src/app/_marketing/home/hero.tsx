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
          className="flex flex-col items-center font-display tracking-[-0.045em] text-balance"
        >
          <span
            className="mk-word text-[clamp(18px,2.3vw,34px)] leading-none font-normal tracking-[-0.02em] text-ink/70 [font-stretch:100%]"
            style={at(0)}
          >
            The AI agent for
          </span>{' '}
          <span
            data-lock="a"
            className="mk-word mt-[0.35em] text-[clamp(30px,9.2vw,56px)] min-[768px]:text-[clamp(56px,7.4vw,112px)] leading-[0.96] font-semibold [font-stretch:125%]"
            style={at(90)}
          >
            launch planning
          </span>{' '}
          <span
            data-lock="b"
            className="mk-word text-[clamp(30px,9.2vw,56px)] min-[768px]:text-[clamp(56px,7.4vw,112px)] leading-[1.02] font-semibold text-accent [font-size:0.978em] [font-stretch:75%]"
            style={at(180)}
          >
            in media &amp; entertainment.
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
