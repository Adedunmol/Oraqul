'use client';

import { Icon } from '@oraqul/ui';
import { useId, useState } from 'react';

import { UseCaseTyper } from './use-case-typer';

/**
 * The real way in: a plain form that hands the message to the app's start screen, which asks
 * signed-out visitors to sign in and then keeps the text. Example questions type themselves into
 * the empty box, and give way to a plain placeholder the moment someone focuses it.
 */
export function HeroPrompt() {
  const id = useId();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  return (
    <form
      action="/start"
      method="get"
      className="flex w-full max-w-[820px] items-center gap-2 rounded-2xl bg-card p-2 pl-5 text-left max-[639px]:rounded-xl max-[639px]:p-1.5 max-[639px]:pl-4 ring-1 ring-line focus-within:ring-0 focus-within:outline-2 focus-within:outline-accent"
    >
      <label htmlFor={id} className="sr-only">
        What are you launching?
      </label>
      <div className="relative min-w-0 flex-1">
        {!value && !focused && (
          <div className="pointer-events-none absolute inset-y-0 -left-4 right-0 flex items-center pl-4 text-[16px] text-muted [mask-image:linear-gradient(to_right,transparent,black_16px)]">
            <UseCaseTyper />
          </div>
        )}
        <input
          id={id}
          name="text"
          maxLength={6000}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="What are you launching, and where?"
          className="w-full bg-transparent py-3 text-[16px] max-[639px]:py-2.5 placeholder:text-transparent focus:placeholder:text-muted focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl max-[639px]:size-10 max-[639px]:rounded-lg bg-primary text-[15px] font-medium text-primary-ink shadow-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="sr-only">Plan it</span>
        <Icon name="sparkles" className="size-4" />
      </button>
    </form>
  );
}
