'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface Step {
  id: string;
  /** The text column: a heading and a few lines. */
  text: ReactNode;
  /** The picture pinned beside the text while this step is active. */
  visual: ReactNode;
}

/**
 * Scroll told as steps: the text scrolls past while one picture stays pinned beside it and swaps
 * to match whichever step crosses the middle of the screen. Inactive steps fade back. From
 * 1000px; below that each step shows its own picture under its text, with nothing pinned.
 */
export function StickySteps({ steps, label }: { steps: Step[]; label: string }) {
  const [active, setActive] = useState(steps[0]?.id ?? '');
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    // A thin band across the middle of the screen: the step inside it is the active one.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-step');
          if (entry.isIntersecting && id) setActive(id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const el of refs.current.values()) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-x-14 min-[1000px]:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <ol aria-label={label} className="flex flex-col max-[999px]:gap-14">
        {steps.map((step) => (
          <li
            key={step.id}
            data-step={step.id}
            ref={(el) => {
              if (el) refs.current.set(step.id, el);
              else refs.current.delete(step.id);
            }}
            className="flex flex-col justify-center gap-8 min-[1000px]:min-h-[70vh]"
          >
            <div
              className={`transition-opacity duration-300 motion-reduce:transition-none ${active === step.id ? 'opacity-100' : 'min-[1000px]:opacity-60'}`}
            >
              {step.text}
            </div>
            <div className="min-[1000px]:hidden">{step.visual}</div>
          </li>
        ))}
      </ol>

      <div className="relative max-[999px]:hidden">
        <div className="sticky top-[calc(50vh-min(40vh,350px))] grid h-[min(80vh,700px)] items-center">
          {steps.map((step) => {
            const on = active === step.id;
            return (
              // Only the showing picture can be read or focused; the rest wait, inert.
              <div
                key={step.id}
                inert={!on}
                className={`col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
              >
                {step.visual}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
