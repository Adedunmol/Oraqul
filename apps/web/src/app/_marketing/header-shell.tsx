'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

const TOP = 80;
/** How far the reader has to keep going one way before the header follows. */
const DOWN = 28;
const UP = 12;

/**
 * The site header, tucked away while reading down the page and back as soon as the reader scrolls up,
 * so it takes no room while there is something to read and is one flick away when there is not. It
 * always shows at the top, while the menu is open, and while focus is inside it, so a keyboard or a
 * screen reader never loses it. Under reduced motion it still hides, without the slide.
 *
 * It also takes the look of whatever section is under it: over a section pinned dark it pins itself
 * dark too, so the bar never sits as a light strip on a dark page.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setReady(true);
    let last = window.scrollY;
    // Distance travelled in the current direction. Smooth scrolling arrives in small steps, so the
    // header follows the run, not any single step.
    let run = 0;
    let frame = 0;
    const sectionTone = () => {
      // Probe just under the header's bottom edge: at the top of the page the header sits above the
      // hero, and while stuck it covers the first pixels of whatever is scrolling beneath it.
      const bottom = ref.current?.getBoundingClientRect().bottom ?? 0;
      const under = document.elementFromPoint(window.innerWidth / 2, Math.max(1, bottom + 1));
      setDark(Boolean(under?.closest('.scheme-dark')));
    };
    const update = () => {
      frame = 0;
      sectionTone();
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      if (delta === 0) return;
      run = Math.sign(delta) === Math.sign(run) ? run + delta : delta;
      const pinned =
        ref.current?.contains(document.activeElement) ||
        document.querySelector('[role="dialog"][aria-label="Main menu"]');
      if (y <= TOP || pinned) setHidden(false);
      else if (run > DOWN) setHidden(true);
      else if (run < -UP) setHidden(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const show = () => setHidden(false);
    sectionTone();
    window.addEventListener('scroll', onScroll, { passive: true });
    const el = ref.current;
    el?.addEventListener('focusin', show);
    return () => {
      window.removeEventListener('scroll', onScroll);
      el?.removeEventListener('focusin', show);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      ref={ref}
      data-site-header=""
      data-ready={ready ? '' : undefined}
      data-hidden={hidden ? '' : undefined}
      className={`${dark ? 'scheme-dark ' : ''}sticky top-0 z-30 bg-bg transition-[transform,background-color] duration-300 data-[hidden]:-translate-y-full motion-reduce:transition-none`}
    >
      {children}
    </header>
  );
}
