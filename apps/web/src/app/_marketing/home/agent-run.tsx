'use client';

import { type CSSProperties, useState } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

type Kind = 'read' | 'tool' | 'code' | 'check' | 'write';

const kindLabel: Record<Kind, string> = {
  read: 'Reads',
  tool: 'Looks up',
  code: 'Works out',
  check: 'Review',
  write: 'Writes',
};

// One invented run, in the words a launch team would use.
const run: { kind: Kind; text: string; out: string }[] = [
  {
    kind: 'read',
    text: 'Series, crime drama, Lagos, London and Houston, 12 March',
    out: 'Job: make a plan',
  },
  { kind: 'code', text: 'Budget not stated: plan for an independent release', out: 'Independent' },
  {
    kind: 'tool',
    text: 'Taste of the comparable shows, Grey Tide and The Ferry Office',
    out: '2 shows, 6 themes',
  },
  {
    kind: 'tool',
    text: 'Rank Lagos, London and Houston for that audience',
    out: '3 ranked',
  },
  {
    kind: 'code',
    text: 'London fit: 0.81 against 0.50 for a neutral audience = 1.62',
    out: 'Strong',
  },
  {
    kind: 'tool',
    text: 'Audience overlap with Harbor Lights, opening 12 March',
    out: 'Overlap: moderate',
  },
  { kind: 'tool', text: 'Partner brands: MTN, Bolt, Verve', out: '3 ranked' },
  {
    kind: 'check',
    text: 'Compare the draft with your request, and rewrite it if it falls short',
    out: 'Passed after 2 drafts',
  },
  { kind: 'write', text: 'Bottom line, one plan per market', out: '9 assumptions, 14 receipts' },
];

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
 * The agent at work: a run streaming in line by line, as lookups, calculations and a self-check.
 * Run again replays it, so the motion explains what the agent does rather than decorating.
 */
export function AgentRun() {
  const [runId, setRunId] = useState(0);
  return (
    <section aria-labelledby="agent-title" className={`scheme-dark mk-glow bg-bg ${band}`}>
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[0.85fr_1.15fr] min-[1000px]:items-center`}
      >
        <div className="flex flex-col gap-8">
          <h2 id="agent-title" className={h2Class}>
            An agent that does the work, and shows it.
          </h2>
          <ul className="flex flex-col gap-5">
            {traits.map(([title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{title}</span>
                  <span className="text-[15px] leading-[1.55] text-ink/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              Oraqul agent run
            </span>
            <span className="flex items-center gap-3">
              <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
                Example
              </span>
              <button
                type="button"
                onClick={() => setRunId((n) => n + 1)}
                className="rounded-md bg-button px-2.5 py-1 text-[12.5px] hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                Run again
              </button>
            </span>
          </div>
          <div className="mk-thinking h-[2px] bg-surface2" aria-hidden="true" />
          <Reveal
            key={runId}
            className="flex flex-col gap-1 p-3 font-mono text-[12.5px] leading-[1.5]"
          >
            <ol aria-label="Agent steps" className="flex flex-col gap-1">
              {run.map((step, i) => (
                <li
                  key={step.text}
                  className="mk-stream grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 rounded-lg px-3 py-2 odd:bg-inset min-[600px]:grid-cols-[72px_minmax(0,1fr)_auto]"
                  style={{ '--i': i } as CSSProperties}
                >
                  <span className={step.kind === 'tool' ? 'text-accent' : 'text-muted'}>
                    {kindLabel[step.kind]}
                  </span>
                  <span className="min-w-0 break-words text-ink">{step.text}</span>
                  <span className="text-ink/70 max-[599px]:col-start-2">
                    <span aria-hidden="true">→ </span>
                    {step.out}
                  </span>
                </li>
              ))}
            </ol>
            <p
              className="mk-stream px-3 pt-2 font-sans text-[14px] text-ink"
              style={{ '--i': run.length } as CSSProperties}
            >
              Open in Lagos, then London. Hold Houston until week two
              <span className="mk-caret" aria-hidden="true" />
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
