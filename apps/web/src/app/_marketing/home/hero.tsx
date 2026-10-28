import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';
import { wrap } from '../section';
import { HeroArt } from './hero-art';
import { HeroPrompt } from './hero-prompt';
import { ProductChat } from './product-chat';

// The height of the first screen: the viewport less the header and a strip at the bottom, so the
// group sits in the vertical middle and only the arc's glow shows under it.
const screen = 'min-h-[clamp(520px,calc(100svh-180px),860px)]';

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

// The six kinds of launch, scattered faintly in the margins either side of the headline so they
// hint at the range without becoming a row to read. Kept clear of the text and the message box.
const marks = [
  { cat: 'film', x: 9, y: 22, size: 64, turn: -12 },
  { cat: 'music', x: 9, y: 58, size: 48, turn: 8 },
  { cat: 'books', x: 7, y: 86, size: 56, turn: -6 },
  { cat: 'podcasts', x: 91, y: 20, size: 52, turn: 10 },
  { cat: 'games', x: 91, y: 56, size: 60, turn: -8 },
  { cat: 'shows', x: 93, y: 84, size: 50, turn: 6 },
] as const;

/**
 * The hero says what the product is before anything else, an AI launch planning agent for media
 * and entertainment, and then shows it: the real chat and plan, rising out of the page. There is
 * no illustration to decode.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      data-top-dark=""
      className="scheme-dark relative overflow-x-clip bg-bg"
    >
      <div aria-hidden="true" className="mk-hero-glow pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[clamp(520px,calc(100svh-180px),860px)] min-[1280px]:block"
      >
        {marks.map((m) => (
          <span
            key={m.cat}
            data-cat={m.cat}
            className="absolute -translate-1/2 text-cat opacity-[0.08]"
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: m.size,
              height: m.size,
              rotate: `${m.turn}deg`,
            }}
          >
            <Icon name={m.cat} className="size-full" />
          </span>
        ))}
      </div>
      {/* The first screen: the headline, the line under it and the box read as one group, centred
          in the first screen, with the arc and the chat starting below it. */}
      <div className={`${wrap} relative flex ${screen} flex-col items-center text-center`}>
        <div className="flex flex-1 flex-col items-center justify-center py-[clamp(24px,6svh,72px)]">
          {/* The promise in the widest Mona Sans, the second half in the accent: two short lines on a
              phone and tablet, one line from 1024px up. The line under it says what the product is. */}
          <p className="mk-pill mb-[clamp(28px,4vw,48px)] rounded-full bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink/80">
            Powered by <span className="text-accent">Qloo</span>
          </p>
          <h1
            id="hero-title"
            className="flex flex-col items-center font-display text-[clamp(28px,13.2vw,58px)] min-[768px]:text-[clamp(48px,7vw,110px)] min-[1024px]:flex-row min-[1024px]:gap-[0.3em] min-[1024px]:text-[clamp(44px,5.9vw,92px)] leading-[1.04] font-semibold tracking-[-0.012em] [word-spacing:0.08em] whitespace-nowrap [font-stretch:125%]"
          >
            <span className="mk-word" style={at(0)}>
              Plan your
            </span>
            <span className="mk-word text-accent" style={at(90)}>
              launch right.
            </span>
          </h1>
          <p
            className="mk-word mt-[clamp(16px,2.4vw,28px)] w-full text-[clamp(16px,1.6vw,22px)] leading-[1.35] text-ink/70 text-balance"
            style={at(220)}
          >
            <b className="font-medium text-ink">
              Build, audit and fix your media &amp; entertainment launch plan
            </b>{' '}
            with Oraqul, a culturally grounded AI agent that even follows up after launch.
          </p>
          <div
            className="mk-rise mt-[clamp(36px,7svh,72px)] flex w-full justify-center"
            style={at(380)}
          >
            <HeroPrompt />
          </div>
        </div>
      </div>
      <div className={`${wrap} relative mt-[clamp(40px,6vw,100px)]`}>
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
