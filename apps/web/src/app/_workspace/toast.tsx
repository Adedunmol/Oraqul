'use client';

import { useEffect, useState } from 'react';

let show: ((message: string) => void) | undefined;

/** Shows a short message at the bottom of the screen. No-op until a Toaster is mounted. */
export function toast(message: string): void {
  show?.(message);
}

export function copyText(text: string, done: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast(done),
    () => toast('Select the text and copy it'),
  );
}

export function Toaster() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    show = (text) => {
      clearTimeout(timer);
      setMessage({ text, key: Date.now() });
      timer = setTimeout(() => setMessage(null), 2600);
    };
    return () => {
      show = undefined;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4"
    >
      {message ? (
        <div
          key={message.key}
          role="status"
          className="pop-in max-w-full rounded-lg bg-ink px-4 py-2.5 font-medium text-bg shadow-lg"
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
