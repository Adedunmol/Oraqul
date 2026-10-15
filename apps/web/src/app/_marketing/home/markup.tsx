import type { Verdict } from '@oraqul/schema';
import { VerdictPill } from '@oraqul/ui';
import type { CSSProperties, ReactNode } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

const glyph: Record<Verdict, string> = { holds: '✓', weak: '◐', breaks: '✕', cant: '◌' };
const tone: Record<Verdict, string> = {
  holds: 'text-holds',
  weak: 'text-weak',
  breaks: 'text-breaks',
  cant: 'text-cant',
};
const word: Record<Verdict, string> = {
  holds: 'Holds',
  weak: 'Weak',
  breaks: 'Breaks',
  cant: 'Could not test',
};

/** A marked span: the colour paints in, and a glyph plus a hidden word says the verdict. */
function Mark({ v, i, children }: { v: Verdict; i: number; children: ReactNode }) {
  return (
    <>
      <span className="mk-mark rounded-sm" data-v={v} style={{ '--i': i } as CSSProperties}>
        {children}
      </span>
      <sup aria-hidden="true" className={`mk-insert ml-0.5 text-[0.7em] ${tone[v]}`}>
        {glyph[v]}
      </sup>
      <span className="sr-only"> ({word[v]})</span>
    </>
  );
}

const paragraphs: { v: Verdict; text: ReactNode; note: string }[] = [
  {
    v: 'holds',
    text: (
      <>
        Our core audience is{' '}
        <Mark v="holds" i={0}>
          fans of Nigerian crime thrillers
        </Mark>
        , mostly 25 to 34.
      </>
    ),
    note: 'Their taste overlaps strongly with yours in Lagos and London.',
  },
  {
    v: 'breaks',
    text: (
      <>
        We open{' '}
        <Mark v="breaks" i={1}>
          in the UK first
        </Mark>{' '}
        <span
          className="mk-insert rounded-sm bg-accent-soft px-1 text-accent"
          style={{ '--i': 1 } as CSSProperties}
        >
          in Canada first
        </span>
        , then the US two weeks later.
      </>
    ),
    note: 'Canada ranked above the UK. The stronger option is written in.',
  },
  {
    v: 'weak',
    text: (
      <>
        A second wave in{' '}
        <Mark v="weak" i={2}>
          Johannesburg
        </Mark>{' '}
        in month two.
      </>
    ),
    note: 'Thin data for this city, so confidence is lower.',
  },
  {
    v: 'cant',
    text: (
      <>
        <Mark v="cant" i={3}>
          Ticket pre sales will cover the marketing spend.
        </Mark>
      </>
    ),
    note: 'Sales are not taste data. You bring these numbers.',
  },
];

/**
 * The check, shown as an editor would do it: a plan on paper, each belief marked in its verdict's
 * colour as it comes on screen, with the verdict and a reason in the margin.
 */
export function Markup() {
  return (
    <section aria-labelledby="markup-title" className={`scheme-dark bg-bg ${band} overflow-x-clip`}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="flex flex-col gap-5 min-[900px]:ml-auto min-[900px]:max-w-[64%] min-[900px]:text-right">
          <h2 id="markup-title" className={h2Class}>
            Paste your plan. Watch every belief get marked.
          </h2>
          <p className="text-[17px] leading-[1.55] text-muted min-[900px]:ml-auto min-[900px]:max-w-[48ch]">
            Each belief is checked against Qloo taste data and marked Holds, Weak, Breaks or Could
            not test, with its reason and its receipt. Anything that breaks comes with a better
            option.
          </p>
        </div>

        <Reveal className="grid gap-y-0 min-[1000px]:grid-cols-[minmax(0,1fr)_300px] min-[1000px]:gap-x-10">
          <div className="scheme-light rounded-t-2xl bg-surface px-[clamp(20px,4vw,48px)] pt-[clamp(24px,4vw,44px)] pb-2 min-[1000px]:col-start-1">
            <p className="text-[12.5px] text-muted">Harmattan · launch plan · draft 3</p>
            <p className="pt-2 font-display text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.03em]">
              Who it is for and where it opens
            </p>
          </div>
          <div className="max-[999px]:hidden" />
          {paragraphs.map((p, i) => (
            <div key={p.note} className="contents">
              <div
                className={`scheme-light flex flex-col gap-3 bg-surface px-[clamp(20px,4vw,48px)] py-3 min-[1000px]:col-start-1 ${i === paragraphs.length - 1 ? 'rounded-b-2xl pb-[clamp(24px,4vw,44px)]' : ''}`}
              >
                <p className="text-[clamp(17px,1.7vw,21px)] leading-[1.7]">{p.text}</p>
                <div
                  className="mk-note flex flex-col items-start gap-1.5 rounded-xl bg-inset p-3 min-[1000px]:hidden"
                  style={{ '--i': i } as CSSProperties}
                >
                  <VerdictPill verdict={p.v} />
                  <p className="text-[13.5px] text-muted">{p.note}</p>
                </div>
              </div>
              <div
                className="mk-note flex flex-col items-start gap-2 border-l border-line py-3 pl-5 max-[999px]:hidden"
                style={{ '--i': i } as CSSProperties}
              >
                <VerdictPill verdict={p.v} />
                <p className="text-[14px] leading-[1.5] text-muted">{p.note}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
