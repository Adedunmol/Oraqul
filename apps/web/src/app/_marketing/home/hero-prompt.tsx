'use client';

import { Icon } from '@oraqul/ui';
import { useId, useState } from 'react';

const examples = [
  'Plan an album release in Berlin and London',
  'Check my plan: UK, then Canada',
  'It missed. Here are our results',
];

/**
 * The real way in: a plain form that hands the message to the app's start screen, which asks
 * signed-out visitors to sign in and then keeps the text.
 */
export function HeroPrompt() {
  const id = useId();
  const [text, setText] = useState('');
  return (
    <div className="flex w-full max-w-[760px] flex-col gap-5">
      <form
        action="/start"
        method="get"
        className="flex items-center gap-2 rounded-2xl bg-card p-2 pl-5 shadow-lg focus-within:outline-2 focus-within:outline-accent"
      >
        <label htmlFor={id} className="sr-only">
          What are you launching?
        </label>
        <input
          id={id}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={6000}
          autoComplete="off"
          placeholder="What are you launching, and where?"
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-medium text-primary-ink shadow-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="max-[479px]:sr-only">Plan it</span>
          <Icon name="arrowUp" className="size-4" />
        </button>
      </form>
      <ul aria-label="Examples" className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => setText(example)}
              className="rounded-xl bg-button px-3.5 py-1.5 text-left text-[13.5px] text-ink/80 hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
