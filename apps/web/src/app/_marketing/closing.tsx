import { buttonClassName } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { wrap } from './section';
import { TasteDiscs } from './taste-discs';

/** The closing call to action: the page's last dark band, with the art back behind it. */
export function Closing({
  title = (
    <>
      Start anywhere.
      <br />
      <span className="text-accent">Leave with a plan to defend.</span>
    </>
  ),
}: {
  title?: ReactNode;
}) {
  return (
    <section aria-labelledby="closing-title" className="scheme-dark relative overflow-hidden bg-bg">
      {/* On a phone the discs land on the buttons, and text is never set over art. */}
      <TasteDiscs set="closing" className="max-[639px]:hidden" />
      <div
        className={`${wrap} relative flex flex-col items-start gap-8 py-[clamp(96px,14vw,200px)]`}
      >
        <h2
          id="closing-title"
          className="font-display text-[clamp(44px,8vw,112px)] leading-[0.95] font-semibold tracking-[-0.05em]"
        >
          {title}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-up" className={buttonClassName('primary')}>
            Create account
          </Link>
          <Link href="/examples" className={buttonClassName('default')}>
            See the examples
          </Link>
        </div>
      </div>
    </section>
  );
}
