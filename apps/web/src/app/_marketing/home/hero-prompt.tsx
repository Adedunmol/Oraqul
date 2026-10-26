import { Icon } from '@oraqul/ui';
import { useId } from 'react';

/**
 * The real way in: a plain form that hands the message to the app's start screen, which asks
 * signed-out visitors to sign in and then keeps the text. The questions typed above it do the
 * showing, so it carries no examples of its own.
 */
export function HeroPrompt() {
  const id = useId();
  return (
    <form
      action="/start"
      method="get"
      className="flex w-full max-w-[680px] items-center gap-2 rounded-2xl bg-card p-2 pl-5 text-left shadow-lg focus-within:outline-2 focus-within:outline-accent"
    >
      <label htmlFor={id} className="sr-only">
        What are you launching?
      </label>
      <input
        id={id}
        name="text"
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
  );
}
