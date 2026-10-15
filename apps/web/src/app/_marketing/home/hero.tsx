import { buttonClassName, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { wrap } from '../section';
import { TasteDiscs } from '../taste-discs';
import { AppPreview } from './app-preview';

const delay = (i: number) => ({ animationDelay: `${i * 70}ms` });

/**
 * The headline marks its two verbs: "Plans" in ultramarine over a highlighter band, and a drawn stroke
 * under "check". Text sits on the plain canvas; the art lives behind the app preview, so nothing
 * is read over colour.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[62%]">
        <div className="mk-dots absolute inset-0" />
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="absolute top-[18%] -right-[18%] aspect-square w-[min(70vw,980px)]"
        >
          {[48, 36, 24].map((r) => (
            <circle
              key={r}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="var(--line)"
              strokeWidth="0.35"
            />
          ))}
        </svg>
      </div>
      <div aria-hidden="true" className="scheme-dark absolute inset-x-0 bottom-0 h-[30%] bg-bg" />

      <div
        className={`${wrap} relative flex flex-col items-start gap-7 pt-[clamp(56px,9vw,128px)] pb-16`}
      >
        <div className="mk-word">
          <p className="flex max-w-full items-start gap-3 rounded-lg bg-surface py-1.5 pr-3 pl-1.5 text-[14px] leading-snug text-muted shadow-[var(--elev-1)] min-[640px]:items-center">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
              <Icon name="sparkles" className="size-3.5" />
            </span>
            <span>
              A verifiable AI agent for launch strategy in media and entertainment
              <span aria-hidden="true" className="mk-caret" />
            </span>
          </p>
        </div>
        <h1
          id="hero-title"
          className="max-w-[14ch] font-display text-[clamp(44px,7.2vw,100px)] font-semibold leading-[1] tracking-[-0.045em]"
        >
          <span className="mk-word" style={delay(0)}>
            <span className="mk-select">Plans</span>
          </span>{' '}
          <span className="mk-word" style={delay(1)}>
            you
          </span>{' '}
          <span className="mk-word" style={delay(2)}>
            can
          </span>{' '}
          <span className="mk-word" style={delay(3)}>
            <span className="mk-check">
              check
              <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d="M2 8 C 22 3, 44 11, 62 6 S 90 4, 98 7"
                  pathLength={1}
                  fill="none"
                  stroke="var(--holds)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            ,
          </span>{' '}
          <span className="mk-word" style={delay(4)}>
            line
          </span>{' '}
          <span className="mk-word" style={delay(5)}>
            by
          </span>{' '}
          <span className="mk-word" style={delay(6)}>
            line.
          </span>
        </h1>

        <div className="mk-word" style={delay(8)}>
          <div className="flex flex-col items-start gap-8">
            <p className="max-w-[48ch] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-ink/75">
              A film or series release, an album or tour, a book launch, a podcast season or a game
              launch: Oraqul plans it, checks the plan you have, or fixes one that missed. Every
              claim is tested against{' '}
              <strong className="font-semibold text-ink">Qloo’s real cultural taste data</strong>{' '}
              and comes with a receipt you can open.
            </p>
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
