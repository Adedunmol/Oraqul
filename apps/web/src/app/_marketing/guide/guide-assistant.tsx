'use client';

import { Icon } from '@oraqul/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { AskGuide } from './ask-guide';

/**
 * The floating help chat on the Guide: a button at the corner that opens a panel with the
 * assistant. Escape closes it and returns focus to the button. It is not modal, so the page stays
 * readable beside it.
 */
export function GuideAssistant() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="fixed right-[clamp(12px,2vw,24px)] bottom-[clamp(12px,2vw,24px)] z-20 flex flex-col items-end gap-3">
      {open ? (
        <section
          id={id}
          aria-label="Guide assistant"
          className="flex max-h-[min(640px,calc(100svh-96px))] w-[min(400px,calc(100vw-24px))] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em]">
              Ask the guide
            </h2>
            <button
              type="button"
              aria-label="Close the assistant"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="close" className="size-4" />
            </button>
          </div>
          <AskGuide />
        </section>
      ) : null}
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="Ask the guide"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-ink shadow-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name={open ? 'close' : 'help'} className="size-5" />
        <span className="max-[479px]:sr-only">Ask the guide</span>
      </button>
    </div>
  );
}
