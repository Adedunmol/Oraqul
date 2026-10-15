import { Confidence, Logo, VerdictPill } from '@oraqul/ui';
import Link from 'next/link';
import { heroLines } from '../../_marketing/sample';
import { leadClass } from '../../_marketing/section';
import { TasteDiscs } from '../../_marketing/taste-discs';

const line = heroLines[0];

/**
 * The marketing side of the auth screens: the pitch and a receipt, on the dark band the landing
 * page uses. Wide screens only; on a phone the form is the whole page. The discs stay on the
 * right edge, clear of the text.
 */
export function AuthAside() {
  return (
    <aside
      aria-label="About Oraqul"
      className="scheme-dark relative hidden h-dvh flex-col gap-10 overflow-hidden bg-bg p-[clamp(32px,4vw,64px)] min-[1000px]:sticky min-[1000px]:top-0 min-[1000px]:flex"
    >
      <TasteDiscs set="auth" />
      <Link
        href="/"
        aria-label="Oraqul home"
        className="relative w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <Logo />
      </Link>
      <div className="relative my-auto flex flex-col gap-10">
        <div className="flex flex-col gap-5">
          <p className="max-w-[12ch] font-display text-[clamp(44px,5vw,76px)] font-semibold leading-[1] tracking-[-0.045em] text-balance">
            <span className="text-accent">Plans</span> you can check, line by line.
          </p>
          <p className={`${leadClass} max-w-[38ch]`}>
            Every claim is tested against Qloo’s cultural taste data and comes with a receipt you
            can open.
          </p>
        </div>
        <section
          aria-label="Example receipt"
          className="flex max-w-[400px] flex-col gap-3 rounded-2xl bg-card p-5 shadow-lg [@media(max-height:700px)]:hidden"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
              Example
            </span>
            <span className="font-mono text-xs text-muted">{line.receipt.callId}</span>
          </div>
          <p className="font-display text-[17px] font-semibold tracking-[-0.02em]">{line.claim}</p>
          <div className="flex flex-wrap items-center gap-2">
            <VerdictPill verdict={line.verdict} />
            <Confidence level={line.confidence} />
          </div>
          <p className="text-[14px] text-muted">{line.receipt.returned}</p>
        </section>
      </div>
    </aside>
  );
}
