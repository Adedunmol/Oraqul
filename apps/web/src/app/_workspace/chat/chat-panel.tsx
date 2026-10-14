'use client';

import type { Output, ThreadItem } from '@oraqul/schema';
import { Button, buttonClassName, ChipButton, Confidence, Kbd, ReceiptChip } from '@oraqul/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/(app)/_components/modal';
import { answerQuestion, markThreadRead, runNextStep, sendMessage } from '@/lib/demo/actions';
import { getNextSteps, type ThreadDetail } from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { toneClass, verdictTone } from '../charts';
import { ReceiptDrawer } from '../output/receipt-drawer';
import { copyText } from '../toast';
import { type Attachment, Composer } from './composer';
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
  const [receipt, setReceipt] = useState<{ output: Output; lineId: string } | null>(null);
  const state = useDemo();
  const steps = useMemo(() => getNextSteps(state, thread.id), [state, thread.id]);

  const openQuestion = [...items].reverse().find((x) => x.role === 'question' && x.answer === null);
  const textOpen = openQuestion?.role === 'question' && openQuestion.question.card === 'text';
  const idle = !busy && !openQuestion;

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

  function send(text: string, files: Attachment[]) {
    if (busy) return;
    const attached = files.length ? `Attached: ${files.map((f) => f.name).join(', ')}` : '';
    sendMessage(thread.id, [text, attached].filter(Boolean).join('\n\n'));
  }

  let placeholder = `Tell Oraqul what to do next with ${project.name}`;
  if (!canEdit) placeholder = 'Chat is off for viewers';
  else if (textOpen) placeholder = 'Type your answer here';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
          {items.map((item, i) => (
            <Item
              key={item.id}
              item={item}
              isNew={i >= from}
              canEdit={canEdit}
              threadId={thread.id}
              output={item.role === 'output' ? outputs.get(item.outputId) : undefined}
              onReceipt={(output, lineId) => setReceipt({ output, lineId })}
            />
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[852px] flex-col gap-2 px-4 pt-1 pb-4">
        {canEdit && idle && steps.length ? (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              Next steps
            </p>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((step) => (
                <ChipButton key={step.id} onClick={() => runNextStep(thread.id, step)}>
                  {step.label}
                </ChipButton>
              ))}
            </div>
          </div>
        ) : null}
        {canEdit ? null : (
          <p className="text-xs text-muted">
            Viewers can read outputs and open evidence. Editors and owners can chat.
          </p>
        )}
        <Composer
          key={thread.id}
          placeholder={placeholder}
          disabled={!canEdit || busy}
          allowFiles
          compact
          onSend={send}
        />
      </div>
      {receipt ? (
        <ReceiptDrawer
          output={receipt.output}
          lineId={receipt.lineId}
          onClose={() => setReceipt(null)}
        />
      ) : null}
    </div>
  );
}

function Item({
  item,
  isNew,
  canEdit,
  threadId,
  output,
  onReceipt,
}: {
  item: ThreadItem;
  isNew: boolean;
  canEdit: boolean;
  threadId: string;
  output: Output | undefined;
  onReceipt: (output: Output, lineId: string) => void;
}) {
  switch (item.role) {
    case 'user':
      return (
        <div
          className={`max-w-[92%] self-end whitespace-pre-wrap rounded-[12px_12px_4px_12px] bg-inset px-3.5 py-2.5 ${isNew ? 'item-new' : ''}`}
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
      return output ? (
        <OutputCard
          output={output}
          isNew={isNew}
          onReceipt={(lineId) => onReceipt(output, lineId)}
        />
      ) : null;
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
        className="fade-in relative overflow-hidden rounded-xl bg-inset px-3.5 pt-3.5 pb-3 text-[12.5px]"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-line">
          <i
            className="block h-full bg-accent transition-[width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mb-1 flex justify-between text-[12px] text-muted">
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
    <details className={`rounded-xl bg-inset px-3.5 py-3 text-[12.5px] ${isNew ? 'item-new' : ''}`}>
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
 * An output in the conversation: one line naming it. The agent's message just above already says
 * the bottom line, so the summary card opens in a dialog instead of filling the chat.
 * design-system §7.13
 */
function OutputCard({
  output,
  isNew,
  onReceipt,
}: {
  output: Output;
  isNew: boolean;
  onReceipt: (lineId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const partner =
    output.kind === 'partner'
      ? output.brief.partners.find((p) => p.id === output.focusIds[0])
      : undefined;
  const hasReceipt = (lineId: string | null): lineId is string =>
    lineId !== null && output.receipts.some((r) => r.lineId === lineId);
  return (
    <div className={`flex flex-wrap items-center gap-2 ${isNew ? 'item-new' : ''}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-full items-center gap-2 rounded-lg bg-button py-1.5 pr-3 pl-2.5 text-[13px] transition-colors hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <KindTag kind={output.kind} label={output.kindLabel} />
        <span className="truncate font-semibold">{output.label}</span>
        <span className="shrink-0 text-muted">Summary</span>
      </button>
      <Link
        href={`/outputs/${output.id}`}
        className="rounded-lg px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        Full details
      </Link>
      <Modal open={open} onClose={() => setOpen(false)} title={output.label} wide>
        <div className="flex flex-col gap-2">
          <p className="font-display text-[21px] font-semibold leading-[1.25] tracking-[-0.02em]">
            {output.headline}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Confidence level={output.confidence.level} />
            <span className="text-muted">{output.confidence.why}</span>
          </div>
        </div>
        {output.moves.length ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-semibold text-muted">Do this</p>
            <ol className="flex flex-col gap-1.5">
              {output.moves.slice(0, 3).map((m, i) => (
                <li
                  key={m.text}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 min-[640px]:grid-cols-[auto_minmax(0,1fr)_auto] rounded-lg bg-card px-3 py-2 text-[14px]"
                >
                  <Kbd>{i + 1}</Kbd>
                  <span>{m.text}</span>
                  {hasReceipt(m.lineId) ? (
                    <ReceiptChip
                      className="col-start-2 justify-self-start min-[640px]:col-start-auto"
                      onClick={() => m.lineId && onReceipt(m.lineId)}
                      aria-label="Open receipt"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {output.stats.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-[13px] text-muted">
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
      </Modal>
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
