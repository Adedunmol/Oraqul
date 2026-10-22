'use client';

import type {
  AuditReport,
  Finding,
  LaunchPlan,
  Output,
  QuestionAnswer,
  ThreadItem,
} from '@oraqul/schema';
import {
  Button,
  buttonClassName,
  ChipButton,
  Confidence,
  Icon,
  Kbd,
  ReceiptChip,
} from '@oraqul/ui';
import Link from 'next/link';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/(app)/_components/modal';
import { answerQuestion, markThreadRead, runNextStep, sendMessage } from '@/lib/demo/actions';
import {
  type ThreadDetail as DemoThreadDetail,
  getNextSteps,
  type NextStep,
} from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { outputPath } from '@/lib/routes';
import { toneClass, verdictTone } from '../charts';
import { formatDay, plural } from '../format';
import { ExportMenu } from '../output/export-menu';
import { FollowUp, PlanDocument, PlanFollowUp } from '../output/plan-document';
import { ReceiptDrawer } from '../output/receipt-drawer';
import { ReportDocument, ReportLines } from '../output/report-document';
import { copyText } from '../toast';
import { type Attachment, Composer } from './composer';
import { QuestionCard } from './question-card';
import { splitQuote, toQuote } from './quote';

// How many items of each thread have been on screen, so a re-render never replays an
// arrival animation (design-system §8). Kept for the session, like the demo state.
const seen = new Map<string, number>();

/** The demo thread's chat, for the output page's dock while outputs are still demo data. */
// User messages after which a chat says older ones are summarised. The server folds the older
// part down once more than 40 lines have not been summarised, so this is a little under that.
const LONG_CHAT = 15;

export function ChatPanel({
  detail,
  canEdit,
  visible = true,
}: {
  detail: DemoThreadDetail;
  canEdit: boolean;
  visible?: boolean;
}) {
  const { thread, project, items, busy } = detail;
  const outputs = useMemo(
    () => new Map(detail.projectOutputs.map((o) => [o.id, o])),
    [detail.projectOutputs],
  );
  const state = useDemo();
  const steps = useMemo(() => getNextSteps(state, thread.id), [state, thread.id]);
  return (
    <ChatView
      threadId={thread.id}
      projectName={project.name}
      items={items}
      outputs={outputs}
      busy={busy}
      canEdit={canEdit}
      visible={visible}
      steps={steps}
      onStep={(step) => runNextStep(thread.id, step)}
      onAnswer={(itemId, answer) => answerQuestion(thread.id, itemId, answer)}
      onSend={(text, files) => {
        const attached = files.length ? `Attached: ${files.map((f) => f.name).join(', ')}` : '';
        sendMessage(thread.id, [text, attached].filter(Boolean).join('\n\n'));
      }}
      onSeen={() => markThreadRead(thread.id)}
    />
  );
}

/**
 * A thread's transcript and message box, drawn from items. Whoever owns the thread's data
 * handles answers, messages and next steps.
 */
export function ChatView({
  threadId,
  projectName,
  items,
  outputs,
  busy,
  canEdit,
  visible = true,
  steps,
  onStep,
  onAnswer,
  onSend,
  onSeen,
  notice,
}: {
  threadId: string;
  /** Null while the router is still reading what the project is. */
  projectName: string | null;
  items: ThreadItem[];
  outputs: Map<string, Output>;
  busy: boolean;
  canEdit: boolean;
  visible?: boolean;
  steps: NextStep[];
  onStep?: (step: NextStep) => void;
  /** `itemId` is the question item's id. */
  onAnswer: (itemId: string, answer: QuestionAnswer) => void;
  onSend: (text: string, files: Attachment[]) => void;
  /** Called when new items have been on screen. */
  onSeen?: () => void;
  /** A line above the message box, such as a lost connection. */
  notice?: ReactNode;
}) {
  // Items from this index on are new. It moves forward once their animations have finished, so
  // typing in the box does not cut a word reveal short.
  const [from, setFrom] = useState(() => seen.get(threadId) ?? items.length);
  const scroller = useRef<HTMLDivElement>(null);
  const [receipt, setReceipt] = useState<{ output: Output; lineId: string } | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const reply = useReplySelection(scroller, canEdit && !busy);

  const openQuestion = [...items].reverse().find((x) => x.role === 'question' && x.answer === null);
  const textOpen = openQuestion?.role === 'question' && openQuestion.question.card === 'text';
  const idle = !busy && !openQuestion;
  const lastOutputId = items.findLast((x) => x.role === 'output')?.outputId;
  // Callers pass a new function each render; reading it from a ref keeps the effect below to
  // real changes in what is on screen.
  const seenCallback = useRef(onSeen);
  seenCallback.current = onSeen;
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  useEffect(() => {
    seen.set(threadId, items.length);
    if (visible) seenCallback.current?.();
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    const settle = setTimeout(() => setFrom(items.length), 2000);
    return () => clearTimeout(settle);
  }, [threadId, items.length, visible]);

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
      answerRef.current(openQuestion.id, { card: 'options', optionIds: [option.id] });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canEdit, visible, openQuestion]);

  function send(text: string, files: Attachment[]) {
    if (busy) return;
    onSend(text, files);
  }

  let placeholder = projectName
    ? `Tell Oraqul what to do next with ${projectName}`
    : 'Tell Oraqul more about it';
  if (!canEdit) placeholder = 'Chat is off for viewers';
  else if (textOpen) placeholder = 'Type your answer here';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
          {items.map((item, i) => (
            <Item
              key={item.id}
              item={item}
              isNew={i >= from}
              canEdit={canEdit}
              onAnswer={onAnswer}
              output={item.role === 'output' ? outputs.get(item.outputId) : undefined}
              onReceipt={(output, lineId) => setReceipt({ output, lineId })}
              onFix={
                canEdit && idle && item.role === 'output' && item.outputId === lastOutputId
                  ? () => send('Fix this plan', [])
                  : undefined
              }
            />
          ))}
        </div>
      </div>
      {reply.pick
        ? createPortal(
            <button
              type="button"
              // Pressing the button must not collapse the selection it is about to quote.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuote(toQuote(reply.pick?.text ?? ''));
                reply.clear();
              }}
              style={{ left: reply.pick.x, top: reply.pick.y }}
              className="fixed z-50 inline-flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[13px] font-semibold text-bg shadow-md hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Icon name="reply" className="size-3.5" />
              Reply
            </button>,
            document.body,
          )
        : null}
      <div className="mx-auto flex w-full max-w-[912px] flex-col gap-2 px-4 pt-1 pb-4">
        {canEdit && idle && steps.length ? (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              Next steps
            </p>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((step) => (
                <ChipButton key={step.id} onClick={() => onStep?.(step)}>
                  {step.label}
                </ChipButton>
              ))}
            </div>
          </div>
        ) : null}
        {notice}
        {items.filter((i) => i.role === 'user').length >= LONG_CHAT ? (
          <p className="text-xs text-muted">
            This chat is getting long, so older messages are summarised and replies may miss detail.
            For a clean slate, start a new chat.
          </p>
        ) : null}
        {canEdit ? null : (
          <p className="text-xs text-muted">
            Viewers can read outputs and open evidence. Editors and owners can chat.
          </p>
        )}
        <Composer
          key={threadId}
          placeholder={placeholder}
          disabled={!canEdit || busy}
          allowFiles
          compact
          quote={quote}
          onClearQuote={() => setQuote(null)}
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

/**
 * Tracks a selection inside the transcript and where to float the Reply button: above the first
 * line of the selection, in viewport coordinates.
 */
function useReplySelection(scroller: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [pick, setPick] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!enabled) {
      setPick(null);
      return;
    }
    const read = () => {
      const selection = document.getSelection();
      const root = scroller.current;
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !root) {
        setPick(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer) || !selection.toString().trim()) {
        setPick(null);
        return;
      }
      const first = range.getClientRects()[0] ?? range.getBoundingClientRect();
      setPick({
        text: selection.toString(),
        x: Math.min(Math.max(first.left + first.width / 2, 48), window.innerWidth - 48),
        y: Math.max(first.top - 8, 44),
      });
    };
    // Read once the pointer or key is released, so the button does not chase a drag.
    const settle = () => requestAnimationFrame(read);
    const hide = () => setPick(null);
    document.addEventListener('mouseup', settle);
    document.addEventListener('keyup', settle);
    const box = scroller.current;
    box?.addEventListener('scroll', hide);
    return () => {
      box?.removeEventListener('scroll', hide);
      document.removeEventListener('mouseup', settle);
      document.removeEventListener('keyup', settle);
    };
  }, [scroller, enabled]);
  return {
    pick,
    clear: () => {
      document.getSelection()?.removeAllRanges();
      setPick(null);
    },
  };
}

function Item({
  item,
  isNew,
  canEdit,
  onAnswer,
  output,
  onReceipt,
  onFix,
}: {
  item: ThreadItem;
  isNew: boolean;
  canEdit: boolean;
  onAnswer: (itemId: string, answer: QuestionAnswer) => void;
  output: Output | undefined;
  onReceipt: (output: Output, lineId: string) => void;
  /** Set on the newest output when the person may fix it: asks for a fixed plan. */
  onFix: (() => void) | undefined;
}) {
  switch (item.role) {
    case 'user': {
      const { quote, body } = splitQuote(item.text);
      return (
        <div
          className={`flex max-w-[92%] flex-col gap-2 self-end whitespace-pre-wrap rounded-[12px_12px_4px_12px] bg-inset px-3.5 py-2.5 ${isNew ? 'item-new' : ''}`}
        >
          {quote ? (
            <p className="line-clamp-3 rounded-lg bg-surface2 px-2.5 py-1.5 text-[13px] text-muted">
              {quote}
            </p>
          ) : null}
          {body}
        </div>
      );
    }
    case 'agent':
      return <AgentText text={item.text} isNew={isNew} />;
    case 'question':
      return (
        <QuestionCard
          item={item}
          canEdit={canEdit}
          isNew={isNew}
          onAnswer={(answer) => onAnswer(item.id, answer)}
        />
      );
    case 'trace':
      return <Trace steps={item.steps} done={item.done} findings={item.findings} isNew={isNew} />;
    case 'output':
      if (output?.kind === 'audit' && output.report) {
        return (
          <ReportCard
            output={output}
            report={output.report}
            isNew={isNew}
            onReceipt={(lineId) => onReceipt(output, lineId)}
            onFix={onFix}
          />
        );
      }
      if (output?.plan) {
        return (
          <PlanCard
            output={output}
            plan={output.plan}
            isNew={isNew}
            onReceipt={(lineId) => onReceipt(output, lineId)}
          />
        );
      }
      return output ? (
        <OutputCard
          output={output}
          isNew={isNew}
          onReceipt={(lineId) => onReceipt(output, lineId)}
        />
      ) : null;
    case 'context':
      return (
        <p className={`text-[13px] text-muted ${isNew ? 'item-new' : ''}`}>
          {item.items.every((i) => i.source === 'saved') ? 'Remembered' : 'Using'}:{' '}
          {item.items.map((i) => i.label).join(' · ')}
        </p>
      );
  }
}

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

// Findings shown while a run is going. The rest are in the folded trace.
const LIVE_FINDINGS = 3;

// The agent's steps and what Qloo found, as plain sentences. Runs with a progress bar, then
// folds into a summary. design-system §7.15
function Trace({
  steps,
  done,
  findings,
  isNew,
}: {
  steps: string[];
  done: number;
  findings: Finding[];
  isNew: boolean;
}) {
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
        {findings.length ? <Findings findings={findings.slice(-LIVE_FINDINGS)} /> : null}
      </div>
    );
  }
  return (
    <details className={`rounded-xl bg-inset px-3.5 py-3 text-[12.5px] ${isNew ? 'item-new' : ''}`}>
      <summary className="cursor-pointer text-muted">
        Agent trace · {plural(steps.length, 'step')}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {steps.map((s) => (
          <Step key={s} text={s} running={false} />
        ))}
      </div>
      {findings.length ? <Findings findings={findings} /> : null}
    </details>
  );
}

// What Qloo returned, one sentence per finding. The plan cites them; the ids stay in Evidence.
function Findings({ findings }: { findings: Finding[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {findings.map((f) => (
        <li key={f.id} className="fade-in text-muted">
          {f.text}
        </li>
      ))}
    </ul>
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

// A launch plan in the conversation is the plan itself, in full, as a document: the agent's
// message above is one line, and everything a reader needs follows. The card holds the plan only.
// The review's open points and suggestions are advice about it, so they sit beneath the card.
function PlanCard({
  output,
  plan,
  isNew,
  onReceipt,
}: {
  output: Output;
  plan: LaunchPlan;
  isNew: boolean;
  onReceipt: (lineId: string) => void;
}) {
  const changes = new Map(output.changes.map((c) => [c.lineId, c]));
  return (
    <div className={`flex flex-col gap-4 ${isNew ? 'item-new' : ''}`}>
      <article className="flex flex-col gap-8 rounded-2xl bg-card px-5 py-6 min-[640px]:px-9 min-[640px]:py-8">
        <OutputHeader output={output}>
          <ExportMenu output={output} />
          <Link
            href={outputPath(output.id)}
            className={buttonClassName('primary', 'default', 'icon')}
          >
            <Icon name="external" className="size-4" />
            Open plan
          </Link>
        </OutputHeader>
        <PlanDocument plan={plan} changes={changes} onSource={onReceipt} />
      </article>
      <PlanFollowUp plan={plan} />
    </div>
  );
}

// An audit report in the conversation is the report itself, as a document. What is worth a look
// and the one next step that follows from it, a fixed plan in the same project, sit beneath it.
function ReportCard({
  output,
  report,
  isNew,
  onReceipt,
  onFix,
}: {
  output: Output;
  report: AuditReport;
  isNew: boolean;
  onReceipt: (lineId: string) => void;
  onFix: (() => void) | undefined;
}) {
  return (
    <div className={`flex flex-col gap-4 ${isNew ? 'item-new' : ''}`}>
      <article className="flex flex-col gap-8 rounded-2xl bg-card px-5 py-6 min-[640px]:px-9 min-[640px]:py-8">
        <OutputHeader output={output}>
          <ExportMenu output={output} />
          <Link
            href={outputPath(output.id)}
            className={buttonClassName('primary', 'default', 'icon')}
          >
            <Icon name="external" className="size-4" />
            Open report
          </Link>
        </OutputHeader>
        <ReportDocument report={report} onSource={onReceipt} />
      </article>
      {report.alternatives.length > 0 || onFix ? (
        <FollowUp label="What to do next">
          <ReportLines
            title="Worth a look"
            lines={report.alternatives}
            report={report}
            onSource={onReceipt}
            quiet
          />
          {onFix ? (
            <div>
              <Button variant="primary" onClick={onFix}>
                Fix this plan
              </Button>
            </div>
          ) : null}
        </FollowUp>
      ) : null}
    </div>
  );
}

// The top of an output's card: what it is, its name, and who made it when, with the actions to
// the side. A rule below keeps the document from running into it.
function OutputHeader({ output, children }: { output: Output; children: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
      <div className="flex min-w-0 flex-col items-start gap-2">
        <KindTag kind={output.kind} label={output.kindLabel} />
        <h3 className="font-display text-[clamp(21px,2.2vw,26px)] leading-[1.2] font-semibold tracking-[-0.025em] text-balance">
          {output.label}
        </h3>
        <p className="text-[13px] text-muted">
          {output.createdBy}, {formatDay(output.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}

// An output in the conversation: one line naming it. The agent's message just above already says
// the bottom line, so the summary card opens in a dialog instead of filling the chat.
// design-system §7.13
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
        href={outputPath(output.id)}
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
          <Link
            href={outputPath(output.id)}
            className={buttonClassName('primary', 'small', 'icon')}
          >
            <Icon name="external" className="size-4" />
            View full details
          </Link>
          <Button
            size="small"
            icon="copy"
            onClick={() => copyText(output.summary, 'Summary copied')}
          >
            Copy summary
          </Button>
          {partner ? (
            <Button
              size="small"
              icon="copy"
              onClick={() => copyText(partner.draft, 'Draft copied')}
            >
              Copy draft
            </Button>
          ) : null}
          <Link
            href={outputPath(output.id, 'evidence')}
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
  const planLike = kind === 'build' || kind === 'audit' || kind === 'fix';
  return (
    <span
      className={`inline-block rounded-full px-2 py-px align-middle text-[11px] font-semibold tracking-[0.02em] ${planLike ? 'bg-accent-soft' : 'bg-surface2'}`}
    >
      {label}
    </span>
  );
}
