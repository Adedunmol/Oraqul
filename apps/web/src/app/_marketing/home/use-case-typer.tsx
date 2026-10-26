'use client';

import { useEffect, useState } from 'react';

// What people actually come to ask, in their own words, across the six kinds of launch and the
// jobs it does: plan, check, fix, revise, run and look again. Each is something Oraqul does today.
const CASES = [
  'I want to launch my new movie. Should I start with Lagos?',
  'I just wrote a book. How should I launch it, and where?',
  'Here is my launch plan and our sales data. What went wrong?',
  'Which city should open our album release run?',
  'A rival series opens the same weekend. Should we move our date?',
  'Is my podcast’s audience really in the US, or somewhere else?',
  'We sold under half in Chicago. Fix the plan.',
  'Which brands would actually say yes to partnering on our game?',
  'Check my plan: we open in the UK, then Canada.',
  'Is London a stronger first market than Houston for our crime drama?',
  'What has changed since we made this plan three weeks ago?',
  'Who should support our headline show in Berlin?',
  'We are staging a comedy night in Manchester. Who comes, and where do we find them?',
  'Turn my launch plan into a content calendar my team can run.',
  'Find me markets we have not thought of for our film.',
  'How should we launch an indie game on a small budget?',
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
