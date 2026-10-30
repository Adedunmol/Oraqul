'use client';

import { useEffect, useState } from 'react';

// What people actually bring, in their own words, chosen to show an agent at work and not a chat
// box: real cities and constraints, their own plan and results, jobs that run over time, and the
// data behind every answer. Each is something Oraqul does today, and none asks for a forecast or
// for anything it will not do. The strongest come first. They type on one line and cut off with an
// ellipsis, so the opening words have to carry the ask.
const CASES = [
  'Plan my film for New York, Los Angeles, Atlanta and London, with the data behind every call.',
  'Here is our launch plan and first-week sales. Find the assumption that broke.',
  'A rival series opens 12 March. How much of our audience do they share? Should we move?',
  'Which of my four cities should open first, and what would change that call?',
  'We sold under half in Chicago. Rebuild the plan around who actually showed up.',
  'Check what has changed since we made this plan three weeks ago.',
  'Find markets I have not thought of for my film, and how to test each one.',
  'Audit my plan: US first, then the UK. Where is it weakest?',
  'Which brands fit our audience and could realistically partner with us in Los Angeles?',
  'Turn this plan into a content calendar my team can run, with a guide for each post.',
  'We tested two teaser angles. Compare our results, and say if it is inconclusive.',
  'I am releasing an album in Nashville and Austin. Who should support us on the run?',
  'I just wrote a book. Which cities and comparable titles should I launch against?',
  'Which topics do the rival podcasts own, and which are open for us?',
  'A comedy night in Philadelphia on a small budget. Who comes, and how should we promote it?',
  'Why did we miss? Set where we planned to win against where the audience really was.',
];

const TYPE_MS = 30;
const CLEAR_MS = 14;
const HOLD_MS = 2400;
const GAP_MS = 380;
const REDUCED_HOLD_MS = 4200;

/**
 * The questions people bring, typed out one at a time and cleared for the next, so a visitor sees
 * their own launch in one of them. Meant to sit over an empty input in place of its placeholder:
 * decoration over a fixed list, so it is hidden from assistive technology. Under reduced motion
 * each one simply stays for a while and gives way to the next, with no typing.
 */
export function UseCaseTyper() {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<'type' | 'hold' | 'clear'>('type');
  const [reduced, setReduced] = useState(false);
  const text = CASES[index] ?? '';
  const typed = text.slice(0, shown);

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
    // Long ones scroll like real typing: the box keeps the newest words and the caret in view and
    // lets the start slide off the left, instead of cutting the end off behind an ellipsis.
    <span aria-hidden="true" className="flex min-w-0 max-w-full justify-end overflow-hidden">
      <span className="shrink-0 whitespace-pre">
        {typed}
        <span className="mk-caret mk-caret-bar" />
      </span>
    </span>
  );
}
