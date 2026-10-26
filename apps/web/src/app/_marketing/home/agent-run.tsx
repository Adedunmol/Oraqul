'use client';

import { useState } from 'react';
import { band, h2Class, wrap } from '../section';
import { ProductChat } from './product-chat';

const traits = [
  [
    'Plans its own steps',
    'It reads your message, decides what to look up, and works one step at a time.',
  ],
  [
    'Checks its own draft',
    'It compares the plan with what you asked for and rewrites it until it fits, in up to three drafts.',
  ],
  ['Shows its receipts', 'Each claim links to the exact data behind it, so you can check it.'],
];

/**
 * The agent at work, in the product's own chat: the run streams in step by step, with what Qloo
 * found as it lands, then the plan. It is the real transcript and trace, replayed on the recorded
 * example, so the motion explains what the agent does rather than decorating.
 */
export function AgentRun() {
  const [runId, setRunId] = useState(0);
  return (
    <section aria-labelledby="agent-title" className={`scheme-dark mk-glow bg-bg ${band}`}>
      <div
        className={`${wrap} grid gap-[clamp(32px,5vw,64px)] min-[1000px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] min-[1000px]:items-center`}
      >
        <div className="flex flex-col gap-8">
          <h2 id="agent-title" className={`${h2Class} text-[clamp(32px,3.8vw,54px)]!`}>
            An agent that does the work, and shows it.
          </h2>
          <ul className="flex flex-col gap-5">
            {traits.map(([title, text]) => (
              <li key={title} className="flex flex-col gap-1">
                <span className="font-medium">{title}</span>
                <span className="text-[15px] leading-[1.55] text-ink/70">{text}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="w-fit rounded-lg bg-button px-4 py-2 text-[14px] font-medium hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            Run it again
          </button>
        </div>
        <div className="min-w-0">
          <ProductChat
            live
            runId={runId}
            className="h-[clamp(520px,60vw,640px)] border border-line"
          />
          <p className="pt-3 text-[12.5px] text-muted">
            The product’s own chat, replaying a recorded example.
          </p>
        </div>
      </div>
    </section>
  );
}
