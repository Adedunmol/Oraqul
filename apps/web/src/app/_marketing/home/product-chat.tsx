'use client';

import type { Finding, Output, ThreadItem } from '@oraqul/schema';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { exampleDetails } from '@/lib/examples';
import { ChatView } from '../../_workspace/chat/chat-panel';
import type { NextStep } from '../../_workspace/chat/next-steps';

// The real chat of the real product, fed the recorded example plan, so what a visitor sees is what
// the signed-in app draws. Nothing here is a mock-up of the interface: the transcript, the agent
// trace and the plan card are the app's own components. It is inert, so it cannot be used.

const example = exampleDetails.film;
const output: Output = example.output;

const PROMPT =
  'Plan the release of Night Ferry, a crime drama series, for London, Houston, Atlanta and Lagos. Comps: Salt Road, The Glass Lantern and Midnight Harbor.';

// The steps a build really takes, in the app's own words.
const STEPS = [
  'Reading your brief',
  'Working out what you need',
  'Finding the comps in Qloo',
  'Choosing what to ask Qloo',
  'Asking Qloo about your audience',
  'Checking release timing and the market',
  'Writing the plan',
  'Checking every line',
  'Checking the plan against your request',
];

// Findings land as the matching step finishes. They are the example plan's own.
const LANDS: [number, string][] = [
  [5, 'f-audience'],
  [5, 'f-markets'],
  [6, 'f-themes'],
];

const NEXT: NextStep[] = [
  { id: 'scn', label: 'What if we open in Houston first?' },
  { id: 'date', label: 'Check rival release dates' },
  { id: 'fix', label: 'Fix this plan' },
];

const outputs = new Map([[output.id, output]]);
const none = () => {};

function findingsFor(done: number): Finding[] {
  const plan = output.plan;
  if (!plan) return [];
  return LANDS.filter(([at]) => done >= at).flatMap(
    ([, id]) => plan.findings.find((f) => f.id === id) ?? [],
  );
}

const TICK = 650;

/**
 * `live` plays the run from the first step, one step at a time, then the agent's reply and the plan.
 * Without it the run is finished, which is how the hero shows it. `runId` plays it again.
 */
export function ProductChat({
  live = false,
  runId = 0,
  className = '',
}: {
  live?: boolean;
  runId?: number;
  className?: string;
}) {
  const id = useId();
  const [done, setDone] = useState(live ? 0 : STEPS.length);
  const [replied, setReplied] = useState(!live);
  const [planned, setPlanned] = useState(!live);
  const frame = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(!live);

  // A live run starts when it is on screen, so a visitor sees it happen rather than its end.
  useEffect(() => {
    const el = frame.current;
    if (!live || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [live]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new runId plays the run again
  useEffect(() => {
    if (!live || !seen) return;
    setDone(0);
    setReplied(false);
    setPlanned(false);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDone(STEPS.length);
      setReplied(true);
      setPlanned(true);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < STEPS.length; i++) {
      timers.push(setTimeout(() => setDone(i + 1), TICK * (i + 1)));
    }
    timers.push(setTimeout(() => setReplied(true), TICK * (STEPS.length + 1)));
    timers.push(setTimeout(() => setPlanned(true), TICK * (STEPS.length + 2)));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [live, seen, runId]);

  // The chat scrolls to its newest line as it grows. Once the plan has landed, a visitor wants its
  // top, not its tail, so the view moves back to the agent's reply; the hero shows it from the start.
  useEffect(() => {
    if (live && !planned) return;
    const transcript = frame.current?.querySelector('[data-chat-transcript]');
    const scroller = transcript?.parentElement;
    if (!transcript || !scroller) return;
    const reply = transcript.children[2];
    scroller.scrollTop = live && reply instanceof HTMLElement ? reply.offsetTop - 12 : 0;
  }, [live, planned]);

  const items = useMemo<ThreadItem[]>(() => {
    const list: ThreadItem[] = [{ id: 'u', role: 'user', text: PROMPT }];
    if (live && done === 0) return list;
    list.push({ id: 't', role: 'trace', steps: STEPS, done, findings: findingsFor(done) });
    if (replied) {
      list.push({
        id: 'a',
        role: 'agent',
        text: `Here is the launch plan for “Night Ferry”. ${output.headline}`,
      });
    }
    if (planned) list.push({ id: 'o', role: 'output', outputId: output.id });
    return list;
  }, [live, done, replied, planned]);

  return (
    <div
      ref={frame}
      inert
      aria-hidden="true"
      className={`product-face product-demo flex flex-col overflow-hidden rounded-2xl bg-bg text-left shadow-lg ${className}`}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
        <span className="font-display text-[15px] font-semibold">Night Ferry</span>
        <span className="text-[13px] text-muted">Film and series</span>
      </div>
      <ChatView
        key={`${id}-${runId}`}
        threadId={`marketing-${id}-${runId}`}
        projectName="Night Ferry"
        items={items}
        outputs={outputs}
        busy={live && !planned}
        canEdit
        steps={NEXT}
        onAnswer={none}
        onSend={none}
      />
    </div>
  );
}
