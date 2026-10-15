'use client';

import { type CSSProperties, useState } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

type Kind = 'read' | 'tool' | 'code' | 'check' | 'write';

const kindLabel: Record<Kind, string> = {
  read: 'Reads',
  tool: 'Tool',
  code: 'Code',
  check: 'Red team',
  write: 'Writes',
};

// One invented run. Tool names are the engine's own (spec §4); no Qloo endpoint is named.
const run: { kind: Kind; text: string; out: string }[] = [
  {
    kind: 'read',
    text: 'Series, crime drama, UK and US',
    out: 'Job: make a plan',
  },
  { kind: 'tool', text: 'searchEntity("Harmattan", series)', out: '1 match' },
  {
    kind: 'tool',
    text: 'resolveBundle(comps: Grey Tide, The Ferry Office)',
    out: '2 comps, 6 tags',
  },
  {
    kind: 'tool',
    text: 'rankPlaces(bundle, UK, US, Canada, Lagos, London)',
    out: '5 ranked',
  },
  { kind: 'code', text: 'lift(London) = 0.81 ÷ 0.50 = 1.62', out: 'Holds' },
  { kind: 'tool', text: 'partnerFit(ages 25 to 34, brands)', out: '3 partners' },
  {
    kind: 'check',
    text: 'Start from a different comp and try to beat the plan',
    out: 'No stronger option',
  },
  { kind: 'write', text: 'Bottom line and three steps', out: '9 beliefs, 11 receipts' },
];

const traits = [
  ['Plans its own steps', 'It reads the job and chooses which tools to call, one step at a time.'],
  [
    'Calls Qloo through tools',
    'Every call is recorded, and every recorded call becomes a receipt.',
  ],
  [
    'Argues with itself',
    'A second model call, blind to the first one’s reasoning, tries to break the top recommendation.',
  ],
  ['Knows when to stop', 'A call budget and a stop rule, so it never loops or pads the answer.'],
];

/**
 * The agent at work: a run streaming in line by line, as tool calls, code and a red team check.
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
              Open in Lagos and London, then Toronto
              <span className="mk-caret" aria-hidden="true" />
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
