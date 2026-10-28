'use client';

import { useState } from 'react';
import { fitBand, h2Class, wrap } from '../section';
import { ProductChat } from './product-chat';

const traits = [
  [
    'Tested checks first',
    'Runs the same tested checks on every plan, then decides which extra lookups it needs when the evidence is thin.',
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
    <section aria-labelledby="agent-title" className={`scheme-dark mk-glow bg-bg ${fitBand}`}>
      <div
        className={`${wrap} grid gap-[clamp(32px,5vw,64px)] min-[1000px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] min-[1000px]:items-center`}
      >
        <div className="flex flex-col gap-9">
          <div className="flex flex-col gap-5">
            <h2 id="agent-title" className={`${h2Class} text-[clamp(32px,3.6vw,48px)]!`}>
              Does the research, checking, drafting and watching.
            </h2>
            <p className="max-w-[40ch] text-[clamp(17px,1.4vw,19px)] leading-[1.65] text-ink/80">
              Anything that leaves Oraqul goes out only after you approve it.
            </p>
          </div>
          <ul className="flex flex-col gap-6">
            {traits.map(([title, text]) => (
              <li key={title} className="flex max-w-[46ch] flex-col gap-1.5">
                <span className="text-[17px] font-medium">{title}</span>
                <span className="text-[16px] leading-[1.65] text-ink/75">{text}</span>
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
            className="h-[clamp(480px,min(60vw,calc(100svh-230px)),640px)] border border-line"
          />
          <p className="pt-3 text-[12.5px] text-muted">
            The product’s own chat, replaying a recorded example.
          </p>
        </div>
      </div>
    </section>
  );
}
