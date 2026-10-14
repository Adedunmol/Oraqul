import { Icon } from '@oraqul/ui';
import type { CSSProperties } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

// The problem as the PRD states it (prd §2, overview "Who it is for"), each paired with its answer.
const pairs = [
  {
    problem:
      'Launch plans rest on beliefs nobody writes down, borrowed from a few comparable titles and instinct.',
    answer: 'Oraqul writes every belief down and tests each one against Qloo taste data.',
  },
  {
    problem:
      'When a launch misses, the team sees what happened but not which belief was wrong, so the relaunch repeats the guess.',
    answer:
      'Add your results and Oraqul finds the belief that broke, then plans around who actually came.',
  },
  {
    problem:
      'Tools give a plan with no evidence, or audience data with no decision. Neither shows its work.',
    answer: 'A decision first, then the plan, with a receipt on every line you can check.',
  },
];

/** Today against with Oraqul, as three rows the reader can scan straight across. */
export function Problems() {
  return (
    <section aria-labelledby="problems-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <h2 id="problems-title" className={`${h2Class} max-w-[20ch]`}>
          Launch plans are bets. Most are made blind.
        </h2>
        <Reveal className="overflow-hidden rounded-2xl bg-card">
          <div className="grid border-b border-line text-[13px] font-medium max-[899px]:hidden min-[900px]:grid-cols-[1fr_56px_1fr]">
            <span className="px-6 py-3.5 text-muted">Today</span>
            <span />
            <span className="flex items-center gap-2 px-6 py-3.5 text-accent">
              With Oraqul
            </span>
          </div>
          <ol>
            {pairs.map((p, i) => (
              <li
                key={p.answer}
                className="grid items-center border-b border-line last:border-0 min-[900px]:grid-cols-[1fr_56px_1fr]"
              >
                <p className="px-6 pt-6 pb-2 text-[17px] leading-[1.55] text-ink/70 min-[900px]:py-7">
                  <span className="sr-only">Today: </span>
                  {p.problem}
                </p>
                <span
                  aria-hidden="true"
                  className="hidden h-full items-center justify-center text-muted min-[900px]:flex"
                >
                  <Icon name="chevron" className="size-5 -rotate-90" />
                </span>
                <p
                  className="mk-in px-6 pt-2 pb-6 text-[18px] leading-[1.5] font-medium min-[900px]:bg-accent-soft min-[900px]:py-7"
                  style={{ '--i': i * 2 + 1 } as CSSProperties}
                >
                  <span className="sr-only">With Oraqul: </span>
                  <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-accent min-[900px]:hidden">
                    With Oraqul
                  </span>
                  {p.answer}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
