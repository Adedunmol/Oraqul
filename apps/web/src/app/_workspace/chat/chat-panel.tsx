'use client';

import type { Output, ThreadItem } from '@oraqul/schema';
import { Button, buttonClassName, ChipButton, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  addResults,
  answerQuestion,
  askScenario,
  markThreadRead,
  quickAsk,
  sendMessage,
} from '@/lib/demo/actions';
import { getCategory } from '@/lib/demo/catalog';
import type { ThreadDetail } from '@/lib/demo/queries';
import { toneClass, verdictTone } from '../charts';
import { copyText } from '../toast';
import { QuestionCard } from './question-card';

// How many items of each thread have been on screen, so a re-render never replays an
// arrival animation (design-system §8). Kept for the session, like the demo state.
const seen = new Map<string, number>();

/** The thread's transcript and message box. Used on the thread page and in the output dock. */
export function ChatPanel({
  detail,
  canEdit,
  visible = true,
}: {
  detail: ThreadDetail;
  canEdit: boolean;
  visible?: boolean;
}) {
  const { thread, project, items, busy } = detail;
  const outputs = useMemo(
    () => new Map(detail.projectOutputs.map((o) => [o.id, o])),
    [detail.projectOutputs],
  );
  // Items from this index on are new. It moves forward once their animations have finished, so
  // typing in the box does not cut a word reveal short.
  const [from, setFrom] = useState(() => seen.get(thread.id) ?? items.length);
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  const openQuestion = [...items].reverse().find((x) => x.role === 'question' && x.answer === null);
  const textOpen = openQuestion?.role === 'question' && openQuestion.question.card === 'text';
  const idle = !busy && !openQuestion;
  const hasPlan = detail.projectOutputs.length > 0;
  const quick = getCategory(project.category).quick;

  useEffect(() => {
    seen.set(thread.id, items.length);
    if (visible) markThreadRead(thread.id);
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    const settle = setTimeout(() => setFrom(items.length), 2000);
    return () => clearTimeout(settle);
  }, [thread.id, items.length, visible]);

  // Number keys pick an option on the open card while no text field has focus. design-system §2.6
  useEffect(() => {
    if (!canEdit || !visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (!/^[1-9]$/.test(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (active && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
      if (openQuestion?.role !== 'question') return;
      const q = openQuestion.question;
      if (q.card !== 'single' && q.card !== 'match') return;
      const option = q.options[Number.parseInt(event.key, 10) - 1];
      if (!option) return;
      event.preventDefault();
      answerQuestion(thread.id, openQuestion.id, { card: 'options', optionIds: [option.id] });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canEdit, visible, openQuestion, thread.id]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    sendMessage(thread.id, text);
  }

  let placeholder = 'Ask Oraqul anything about this project';
  if (!canEdit) placeholder = 'Chat is off for viewers';
  else if (textOpen) placeholder = 'Type your answer here';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
        {items.map((item, i) => (
          <Item
            key={item.id}
            item={item}
            isNew={i >= from}
            canEdit={canEdit}
            threadId={thread.id}
            output={item.role === 'output' ? outputs.get(item.outputId) : undefined}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
        {canEdit && idle && hasPlan ? (
          <div className="flex flex-wrap gap-1.5">
            <ChipButton onClick={() => askScenario(thread.id)}>Run a scenario</ChipButton>
            <ChipButton onClick={() => quickAsk(thread.id, quick.date)}>{quick.date}</ChipButton>
            <ChipButton onClick={() => addResults(thread.id)}>{quick.results}</ChipButton>
            <ChipButton onClick={() => quickAsk(thread.id, quick.partner)}>
              {quick.partner}
            </ChipButton>
          </div>
        ) : null}
        {canEdit ? null : (
          <p className="text-xs text-muted">
            Viewers can read outputs and open evidence. Editors and owners can chat.
          </p>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor={`chat-${thread.id}`} className="sr-only">
            Message
          </label>
          <input
            id={`chat-${thread.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={!canEdit || busy}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-[9px] text-sm placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45 disabled:opacity-60"
          />
          <Button type="submit" variant="primary" disabled={!canEdit || busy || !draft.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function Item({
  item,
  isNew,
  canEdit,
  threadId,
  output,
}: {
  item: ThreadItem;
  isNew: boolean;
  canEdit: boolean;
  threadId: string;
  output: Output | undefined;
}) {
  switch (item.role) {
    case 'user':
      return (
        <div
          className={`max-w-[92%] self-end whitespace-pre-wrap rounded-[16px_16px_4px_16px] bg-surface px-3.5 py-2.5 ${isNew ? 'item-new' : ''}`}
        >
          {item.text}
        </div>
      );
    case 'agent':
      return <AgentText text={item.text} isNew={isNew} />;
    case 'question':
      return (
        <QuestionCard
          item={item}
          canEdit={canEdit}
          isNew={isNew}
          onAnswer={(answer) => answerQuestion(threadId, item.id, answer)}
        />
      );
    case 'trace':
      return <Trace steps={item.steps} done={item.done} isNew={isNew} />;
    case 'output':
      return output ? <OutputCard output={output} isNew={isNew} /> : null;
  }
}

/** Agent text, revealed word by word the first time it shows. design-system §8 */
function AgentText({ text, isNew }: { text: string; isNew: boolean }) {
  if (!isNew) return <div className="whitespace-pre-wrap text-[15.5px] leading-[1.6]">{text}</div>;
  let n = 0;
  return (
    <div className="item-new text-[15.5px] leading-[1.6]">
      {text.split(/(\s+)/).map((part, i) =>
        /^\s*$/.test(part) ? (
          part.includes('\n') ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: word positions are the identity here
            <br key={i} />
          ) : (
            part
          )
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: word positions are the identity here
            key={i}
            className="word-in"
            style={{ animationDelay: `${Math.min(1600, n++ * 26)}ms` }}
          >
            {part}
          </span>
        ),
      )}
    </div>
  );
}

/** The agent's steps. Runs with a progress bar, then folds into a summary. design-system §7.15 */
function Trace({ steps, done, isNew }: { steps: string[]; done: number; isNew: boolean }) {
  if (done < steps.length) {
    const pct = Math.max(6, Math.round((done / steps.length) * 100));
    return (
      <div
        aria-live="polite"
        className="fade-in relative overflow-hidden rounded-[14px] bg-surface px-3.5 pt-3.5 pb-3 text-[12.5px]"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-line">
          <i
            className="block h-full bg-accent transition-[width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mb-1 flex justify-between text-[11px] uppercase tracking-[0.04em] text-muted">
          <span>Working</span>
          <span className="font-mono">
            Step {done + 1} of {steps.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {steps.slice(0, done + 1).map((s, i) => (
            <Step key={s} text={s} running={i === done} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <details
      className={`rounded-[14px] bg-surface px-3.5 py-3 text-[12.5px] ${isNew ? 'item-new' : ''}`}
    >
      <summary className="cursor-pointer text-muted">Agent trace · {steps.length} steps</summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {steps.map((s) => (
          <Step key={s} text={s} running={false} />
        ))}
      </div>
    </details>
  );
}

function Step({ text, running }: { text: string; running: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {running ? (
        <span
          aria-hidden="true"
          className="mt-px size-3.5 flex-none animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
        />
      ) : (
        <span
          aria-hidden="true"
          className="mt-px grid size-3.5 flex-none place-items-center rounded-full bg-holds text-[9px] font-bold text-bg"
        >
          ✓
        </span>
      )}
      <span className={`min-w-0 flex-1 ${running ? 'shimmer-text' : ''}`}>{text}</span>
    </div>
  );
}

/**
 * An output in the conversation: one small button naming it, so the chat reads as a conversation.
 * The button opens the summary in place, and View full details goes to the output page.
 */
function OutputCard({ output, isNew }: { output: Output; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const partner =
    output.kind === 'partner'
      ? output.brief.partners.find((p) => p.id === output.focusIds[0])
      : undefined;
  return (
    <div className={`flex flex-col items-start gap-2 ${isNew ? 'item-new' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-2 rounded-[10px] bg-surface2 py-1.5 pr-2.5 pl-3 text-[13px] transition-colors hover:bg-surface2-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <KindTag kind={output.kind} label={output.kindLabel} />
        <span className="truncate font-semibold">{output.label}</span>
        <span className="shrink-0 text-muted">{open ? 'Hide summary' : 'Show summary'}</span>
        <Icon
          name="chevron"
          className={`size-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <article
          id={panelId}
          className="pop-in flex w-full flex-col gap-3 rounded-2xl bg-surface p-4"
        >
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {output.stats.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 text-[13px] text-muted"
              >
                {s.verdict ? (
                  <i
                    aria-hidden="true"
                    className={`size-2.5 rounded-[3px] ${toneClass[verdictTone[s.verdict]]}`}
                  />
                ) : null}
                {s.label} <b className="text-ink tabular-nums">{s.value}</b>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/outputs/${output.id}`} className={buttonClassName('primary', 'small')}>
              View full details
            </Link>
            <Button size="small" onClick={() => copyText(output.summary, 'Summary copied')}>
              Copy summary
            </Button>
            {partner ? (
              <Button size="small" onClick={() => copyText(partner.draft, 'Draft copied')}>
                Copy draft
              </Button>
            ) : null}
            <Link
              href={`/outputs/${output.id}?tab=evidence`}
              className={buttonClassName('ghost', 'small')}
            >
              Evidence{' '}
              <span className="rounded-full bg-surface2 px-1.5 text-[11px] tabular-nums">
                {output.evidence.length}
              </span>
            </Link>
          </div>
        </article>
      ) : null}
    </div>
  );
}

export function KindTag({ kind, label }: { kind: Output['kind']; label: string }) {
  const planLike = kind === 'plan' || kind === 'audit';
  return (
    <span
      className={`inline-block rounded-full px-2 py-px align-middle text-[11px] font-semibold tracking-[0.02em] ${planLike ? 'bg-accent-soft' : 'bg-surface2'}`}
    >
      {label}
    </span>
  );
}
