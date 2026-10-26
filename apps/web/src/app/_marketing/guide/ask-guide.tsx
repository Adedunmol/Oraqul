'use client';

import { GUIDE_HISTORY_MAX, GUIDE_QUESTION_MAX, type GuideAnswer } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { askGuide } from '../../../lib/api/guide';
import { ApiError } from '../../../lib/api/http';

interface Turn {
  id: number;
  question: string;
  answer?: GuideAnswer;
  error?: string;
}

const SUGGESTIONS = [
  'What should I put in my first message?',
  'How do I check a plan I already have?',
  'What does Weak mean?',
];

function failure(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'You have asked a lot of questions this hour. The pages here have the answers, or try again later.';
  }
  return 'The guide assistant is not available right now. The pages here have the answers.';
}

/**
 * Asks the Guide's help bot. Answers come from the Guide's own pages and name them, so a visitor
 * can read the source. Nothing is stored in the browser; a reload starts a new chat.
 */
export function AskGuide({ suggest = true }: { suggest?: boolean }) {
  const id = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const count = useRef(0);

  async function send(question: string) {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    const history = turns
      .filter((t) => t.answer)
      .slice(-GUIDE_HISTORY_MAX / 2)
      .flatMap((t) => [
        { role: 'user' as const, text: t.question },
        { role: 'assistant' as const, text: t.answer?.answer ?? '' },
      ]);
    setTurns((all) => [...all, { id: count.current++, question: q }]);
    setText('');
    setBusy(true);
    try {
      const answer = await askGuide({ question: q, history });
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, answer } : t)));
    } catch (error) {
      setTurns((all) =>
        all.map((t, i) => (i === all.length - 1 ? { ...t, error: failure(error) } : t)),
      );
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite" className="flex flex-col gap-4 empty:hidden">
        {turns.map((t) => (
          <div key={t.id} className="flex flex-col gap-2">
            <p className="text-[15px] font-semibold">{t.question}</p>
            {t.answer ? (
              <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
                <p className="max-w-[62ch] whitespace-pre-line text-[15.5px] leading-[1.6] text-ink/85">
                  {t.answer.answer}
                </p>
                {t.answer.sources.length > 0 ? (
                  <p className="flex flex-wrap gap-x-3 text-[13.5px] text-muted">
                    From the guide:
                    {t.answer.sources.map((s) => (
                      <Link
                        key={s.slug}
                        href={`/guide/${s.slug}`}
                        className="text-accent underline"
                      >
                        {s.title}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : t.error ? (
              <p role="alert" className="rounded-2xl bg-card p-4 text-[15px] text-muted">
                {t.error}
              </p>
            ) : (
              <p className="mk-thinking text-[15px] text-muted">Looking it up in the guide</p>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-end gap-2 rounded-2xl bg-card p-2 pl-5 focus-within:outline-2 focus-within:outline-accent"
      >
        <label htmlFor={id} className="sr-only">
          Ask the guide a question
        </label>
        <textarea
          id={id}
          ref={field}
          rows={1}
          value={text}
          maxLength={GUIDE_QUESTION_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="Ask how to use Oraqul"
          className="min-w-0 flex-1 resize-none bg-transparent py-3 text-[16px] placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length < 2}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-medium text-primary-ink shadow-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          <span className="max-[479px]:sr-only">Ask</span>
          <Icon name="arrowUp" className="size-4" />
        </button>
      </form>
      {suggest && turns.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full bg-surface2 px-3.5 py-1.5 text-[14px] text-ink/80 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-[13px] text-muted">
        Answers come from these guide pages. Leave out personal details.
      </p>
    </div>
  );
}
