'use client';

import type {
  Answer,
  Finding,
  Output,
  QuestionAnswer,
  QuestionCard,
  ThreadDetail,
  ThreadEvent,
  ThreadItem,
} from '@oraqul/schema';
import { Button } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { markThreadRead, postMessage } from '@/lib/api/projects';
import { toast } from '../toast';
import { ChatView } from './chat-panel';
import type { Attachment } from './composer';
import { nextStepsFor } from './next-steps';
import { useThreadEvents } from './use-thread-events';

type ProjectUpdate = Extract<ThreadEvent, { type: 'project.updated' }>;

/**
 * A thread's chat on the real API: the stored transcript from the server, then the run's events
 * as they stream in. The message box and the cards post back; the reply comes on the stream.
 */
export function LiveChat({
  detail,
  canEdit,
  onProjectUpdated,
}: {
  detail: ThreadDetail;
  canEdit: boolean;
  onProjectUpdated: (update: ProjectUpdate) => void;
}) {
  const router = useRouter();
  const threadId = detail.thread.id;
  const [items, setItems] = useState<ThreadItem[]>(detail.items);
  const [busy, setBusy] = useState(detail.busy);
  const outputs = useMemo(
    () => new Map<string, Output>(detail.projectOutputs.map((o) => [o.id, o])),
    [detail.projectOutputs],
  );

  // Steps follow the latest output, until the person says or is asked something else.
  const steps = useMemo(() => {
    const at = items.findLastIndex((i) => i.role === 'output');
    const moved = items.slice(at + 1).some((i) => i.role === 'user' || i.role === 'question');
    return at === -1 || moved ? [] : nextStepsFor([...outputs.values()]);
  }, [items, outputs]);

  const onEvent = useCallback(
    (event: ThreadEvent) => {
      switch (event.type) {
        case 'trace.step':
          setBusy(true);
          setItems((list) => withStep(list, event.text));
          return;
        case 'finding':
          setItems((list) => withFinding(list, event.finding));
          return;
        case 'question':
          setItems((list) => [
            ...finishTrace(list),
            { id: `question:${event.id}`, role: 'question', question: toCard(event), answer: null },
          ]);
          return;
        case 'message':
          setItems((list) => [...finishTrace(list), agentItem(event.body)]);
          return;
        case 'error':
          setItems((list) => [...finishTrace(list), agentItem(event.message)]);
          return;
        case 'output.created':
          setItems((list) => [
            ...finishTrace(list),
            { id: `output:${event.outputId}`, role: 'output', outputId: event.outputId },
          ]);
          return;
        case 'memory.used':
          setItems((list) => [
            ...list,
            { id: `context:${Date.now()}`, role: 'context', items: event.items },
          ]);
          return;
        case 'project.updated':
          onProjectUpdated(event);
          return;
        case 'run.stopped':
          setBusy(false);
          setItems(finishTrace);
          // The reply lands while busy, when onSeen skips marking, and stopping adds no item to
          // fire it again. The chat is on screen, so mark it here. The sidebar, lists and chat
          // names read the server; refresh once the mark is saved so they agree.
          void markThreadRead(threadId)
            .catch(() => undefined)
            .finally(() => router.refresh());
          return;
        case 'receipt':
          return;
      }
    },
    [onProjectUpdated, router, threadId],
  );

  const { status, retry } = useThreadEvents(threadId, detail.lastSeq, onEvent);

  async function send(text: string, files: Attachment[]) {
    const open = openQuestion(items);
    const attachments = files.map((f) => ({ name: f.name, text: f.text }));
    const shown = [text, files.length ? `Attached: ${files.map((f) => f.name).join(', ')}` : '']
      .filter(Boolean)
      .join('\n\n');
    const before = items;
    setItems((list) => [
      ...answerOpen(list, text),
      { id: `local:${Date.now()}`, role: 'user', text: shown },
    ]);
    setBusy(true);
    try {
      await postMessage(threadId, { kind: 'text', text, attachments });
    } catch {
      setItems(before);
      setBusy(false);
      toast(
        open ? 'Your answer was not sent. Try again.' : 'Your message was not sent. Try again.',
      );
    }
  }

  async function answer(itemId: string, value: QuestionAnswer) {
    const item = items.find((i) => i.id === itemId);
    if (item?.role !== 'question') return;
    const sent = toAnswer(item.question, value);
    if (!sent) {
      toast('Type your answer in the message box instead.');
      return;
    }
    const before = items;
    setItems((list) =>
      list.map((i) =>
        i.id === itemId && i.role === 'question' ? { ...i, answer: sent.label } : i,
      ),
    );
    setBusy(true);
    try {
      await postMessage(threadId, { kind: 'answer', answer: sent.answer });
    } catch {
      setItems(before);
      setBusy(false);
      toast('Your answer was not sent. Try again.');
    }
  }

  const notice =
    status === 'live' ? null : (
      <p role="status" className="flex items-center gap-2 text-xs text-muted">
        {status === 'reconnecting'
          ? 'Connection lost. Reconnecting…'
          : 'Lost the connection to Oraqul.'}
        {status === 'lost' ? (
          <Button size="small" onClick={retry}>
            Try again
          </Button>
        ) : null}
      </p>
    );

  return (
    <ChatView
      threadId={threadId}
      projectName={detail.project.name}
      items={items}
      outputs={outputs}
      busy={busy}
      canEdit={canEdit}
      steps={steps}
      onStep={(step) => {
        if (step.message) void send(step.message, []);
      }}
      onAnswer={answer}
      onSend={send}
      onSeen={() => {
        if (!busy) void markThreadRead(threadId).catch(() => undefined);
      }}
      notice={notice}
    />
  );
}

function agentItem(text: string): ThreadItem {
  return { id: `agent:${crypto.randomUUID()}`, role: 'agent', text };
}

function withStep(list: ThreadItem[], text: string): ThreadItem[] {
  const last = list.at(-1);
  if (last?.role === 'trace' && last.done < last.steps.length) {
    const steps = [...last.steps, text];
    return [...list.slice(0, -1), { ...last, steps, done: steps.length - 1 }];
  }
  return [
    ...list,
    { id: `trace:${crypto.randomUUID()}`, role: 'trace', steps: [text], done: 0, findings: [] },
  ];
}

function withFinding(list: ThreadItem[], finding: Finding): ThreadItem[] {
  const last = list.at(-1);
  if (last?.role !== 'trace') return list;
  return [...list.slice(0, -1), { ...last, findings: [...last.findings, finding] }];
}

function finishTrace(list: ThreadItem[]): ThreadItem[] {
  return list.map((i) => (i.role === 'trace' ? { ...i, done: i.steps.length } : i));
}

function openQuestion(list: ThreadItem[]) {
  return list.findLast((i) => i.role === 'question' && i.answer === null);
}

function answerOpen(list: ThreadItem[], text: string): ThreadItem[] {
  const open = openQuestion(list);
  return open
    ? list.map((i) => (i === open && i.role === 'question' ? { ...i, answer: text } : i))
    : list;
}

function toCard(event: Extract<ThreadEvent, { type: 'question' }>): QuestionCard {
  const { id, prompt, options, hint } = event;
  switch (event.card) {
    case 'text':
      return { id, prompt, card: 'text', hint: hint ?? '' };
    case 'match':
      return { id, prompt, card: 'match', options };
    case 'multi':
      return { id, prompt, card: 'multi', options };
    default:
      return { id, prompt, card: 'single', options, hint };
  }
}

function toAnswer(
  question: QuestionCard,
  value: QuestionAnswer,
): { answer: Answer; label: string } | null {
  if (value.card === 'options' && 'options' in question) {
    const labels = question.options
      .filter((o) => value.optionIds.includes(o.id))
      .map((o) => o.label);
    return {
      answer: { kind: 'options', questionId: question.id, optionIds: value.optionIds },
      label: labels.join(', '),
    };
  }
  return null;
}
