'use client';

import { type HTMLAttributes, useEffect, useRef, useState } from 'react';

/**
 * Marks its block `data-shown` the first time an eighth of it is on screen, which starts the CSS
 * in marketing.css. An eighth, not more, so a tall block on a short phone still qualifies. It
 * never unsets, so nothing replays on scroll back.
 */
export function Reveal({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-reveal="" data-shown={shown ? '' : undefined} {...props}>
      {children}
    </div>
  );
}
