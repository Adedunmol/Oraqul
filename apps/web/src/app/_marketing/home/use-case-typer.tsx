'use client';

import { useEffect, useState } from 'react';

// What people actually bring, in their own words, chosen to show an agent at work and not a chat
// box: real cities and constraints, their own plan and results, jobs that run over time, and the
// data behind every answer. Each is something Oraqul does today, and none asks for a forecast or
// for anything it will not do. The strongest come first. Keep each under about 90 characters so
// the longest still fits three lines on a phone.
const CASES = [
  'Plan my film for London, Houston, Atlanta and Lagos, with the data behind every call.',
  'Here is our launch plan and first-week sales. Find the assumption that broke.',
  'A rival series opens 12 March. How much of our audience do they share? Should we move?',
  'Which of my four cities should open first, and what would change that call?',
  'We sold under half in Chicago. Rebuild the plan around who actually showed up.',
  'Check what has changed since we made this plan three weeks ago.',
  'Find markets I have not thought of for my film, and how to test each one.',
  'Audit my plan: UK first, then Canada. Where is it weakest?',
  'Which brands fit our audience and could realistically partner with us in Lagos?',
  'Turn this plan into a content calendar my team can run, with a guide for each post.',
  'We tested two teaser angles. Compare our results, and say if it is inconclusive.',
  'I am releasing an album in Berlin and London. Who should support us on the run?',
  'I just wrote a book. Which cities and comparable titles should I launch against?',
  'Which topics do the rival podcasts own, and which are open for us?',
  'A comedy night in Manchester on a small budget. Who comes, and how should we promote it?',
  'Why did we miss? Set where we planned to win against where the audience really was.',
];

const TYPE_MS = 30;
const CLEAR_MS = 14;
const HOLD_MS = 2400;
const GAP_MS = 380;
const REDUCED_HOLD_MS = 4200;

/**
 * The questions people bring, typed out one at a time and cleared for the next, so a visitor sees
 * their own launch in one of them. Decoration over a fixed list, so it is hidden from assistive
 * technology and replaced by a short sentence it can read. Under reduced motion each one simply
 * stays for a while and gives way to the next, with no typing.
 */
export function UseCaseTyper() {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<'type' | 'hold' | 'clear'>('type');
  const [reduced, setReduced] = useState(false);
  const text = CASES[index] ?? '';
  // The last word, the caret and the closing quote never part, so a sentence that exactly fills the
  // line cannot leave a quote on a line of its own.
  const typed = text.slice(0, shown);
  const cut = typed.lastIndexOf(' ') + 1;
  const head = typed.slice(0, cut);
  const tail = typed.slice(cut);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      const t = setTimeout(() => setIndex((i) => (i + 1) % CASES.length), REDUCED_HOLD_MS);
      return () => clearTimeout(t);
    }
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'type') {
      if (shown < text.length) t = setTimeout(() => setShown(shown + 1), TYPE_MS);
      else t = setTimeout(() => setPhase('hold'), 0);
    } else if (phase === 'hold') {
      t = setTimeout(() => setPhase('clear'), HOLD_MS);
    } else if (shown > 0) {
      const step = Math.max(2, Math.ceil(text.length / 14));
      t = setTimeout(() => setShown(Math.max(0, shown - step)), CLEAR_MS);
    } else {
      t = setTimeout(() => {
        setIndex((i) => (i + 1) % CASES.length);
        setPhase('type');
      }, GAP_MS);
    }
    return () => clearTimeout(t);
  }, [phase, shown, text, reduced]);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <p className="sr-only">
        Ask it things like “{CASES[0]}”, “{CASES[1]}” or “{CASES[2]}”.
      </p>
      <p
        aria-hidden="true"
        className="min-h-[3.96em] text-[clamp(18px,2.1vw,27px)] min-[640px]:min-h-[2.7em] leading-[1.32] font-medium tracking-[-0.02em] text-ink"
      >
        “{head}
        <span className="whitespace-nowrap">
          {tail}
          <span className="mk-caret" />”
        </span>
      </p>
    </div>
  );
}
