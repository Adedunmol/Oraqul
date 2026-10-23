import type { Verdict } from '@oraqul/schema';
import { Confidence, Icon, type IconName, VerdictPill } from '@oraqul/ui';
import type { CSSProperties, ReactNode } from 'react';
import { Reveal } from '../reveal';
import { band, h2Class, wrap } from '../section';

// An icon, not a count: the steps are told apart by what they do, and the arrow at each seam moves you on.
function StepHead({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-2xl bg-card text-accent shadow-[var(--elev-1)]"
      >
        <Icon name={icon} className="size-6" />
      </span>
      <h2 className={h2Class}>
        <span className="sr-only">Step {n}: </span>
        {title}
      </h2>
      <div className="flex max-w-[46ch] flex-col gap-4 text-[17px] leading-[1.6] text-ink/75">
        {children}
      </div>
    </div>
  );
}

function NextStep() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 z-10 flex translate-y-1/2 justify-center"
    >
      <span className="mk-nudge grid size-12 place-items-center rounded-full bg-primary text-primary-ink shadow-[var(--elev-2)] ring-4 ring-bg">
        <Icon name="chevron" className="size-5" />
      </span>
    </div>
  );
}

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

export function TraceCard() {
  const steps = [
    'Reading the message: series, crime drama',
    'Finding Night Ferry and its comparable titles',
    'Looking up who else your audience loves',
    'Ranking the UK, Canada and the US',
    'Testing 9 assumptions in the plan',
    'Writing the bottom line',
  ];
  return (
    <Reveal className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-md">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold">Agent trace</span>
        <span className="text-muted">Example</span>
      </div>
      <div className="h-[2px] overflow-hidden rounded-full bg-surface2">
        <span className="mk-axis block h-full bg-accent" />
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <li
            key={s}
            className="mk-in flex items-center gap-3 rounded-lg bg-inset px-3 py-2.5 text-[14px]"
            style={stagger(i)}
          >
            <Icon name="check" className="size-4 shrink-0 text-holds" />
            {s}
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

export function Describe() {
  const notes = [
    'Text, files or both. Up to five files.',
    'The hints are optional. Pick one, or just type.',
    'The project is saved when you send.',
  ];
  return (
    <section aria-label="Step 1" className={`relative mk-lit bg-accent-soft ${band}`}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="grid gap-8 min-[1000px]:grid-cols-[1fr_1fr] min-[1000px]:items-end">
          <StepHead n={1} icon="attach" title="Describe it in one message.">
            <p>
              Say what you are working on the way you would to a colleague. Oraqul works out the
              category and the job from what you write.
            </p>
          </StepHead>
          <ul className="flex flex-col gap-3 min-[1000px]:pb-3">
            {notes.map((note) => (
              <li key={note} className="flex gap-3 text-[15px]">
                <Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent" />
                {note}
              </li>
            ))}
          </ul>
        </div>

        <Reveal className="mx-auto flex w-full max-w-[860px] flex-col gap-5 rounded-2xl bg-card p-[clamp(18px,3vw,32px)] shadow-md">
          <p className="mk-in text-[16px]" style={stagger(0)}>
            What are you working on? Tell me the title and what you want to know.
          </p>
          <div
            className="mk-in flex items-end gap-3 rounded-xl border border-accent bg-surface px-4 py-3.5 outline-2 outline-accent/45"
            style={stagger(1)}
          >
            <p className="min-w-0 flex-1 text-[clamp(16px,1.6vw,19px)] leading-[1.5]">
              Plan the release of Night Ferry, a Mexico City crime drama series, for the UK and the
              US. Comparable shows are Grey Tide and The Ferry Office.
            </p>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-ink">
              <Icon name="arrowUp" className="size-4" />
            </span>
          </div>
          <div className="mk-in flex flex-wrap items-center gap-2" style={stagger(2)}>
            <span className="text-[13.5px] text-muted">Not sure how to put it? Start from:</span>
            {['Make a plan', 'Check my plan', 'Fix my plan'].map((c, i) => (
              <span
                key={c}
                className={`rounded-md px-2.5 py-1 text-[12.5px] ${i === 0 ? 'border border-accent/40 bg-accent-soft font-semibold text-accent' : 'bg-button'}`}
              >
                {c}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
      <NextStep />
    </section>
  );
}

export function Asks() {
  return (
    <section aria-label="Step 2" className={`relative scheme-dark bg-bg ${band}`}>
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[0.9fr_1.1fr] min-[1000px]:items-center`}
      >
        <StepHead n={2} icon="help" title="It states its assumptions and asks only when it must.">
          <p>
            Oraqul says what it read and what it assumed, with an example of how to correct it. It
            asks a question only when a wrong assumption would waste the run: the category, the
            title, which match in the data is yours, and, for a full plan, the budget band, which
            decides what it may propose.
          </p>
          <p>Type a correction any time. Only what it changes runs again.</p>
        </StepHead>

        <Reveal className="flex flex-col gap-4">
          <p className="mk-in max-w-[56ch] text-[16.5px] leading-[1.65]" style={stagger(0)}>
            Reading this as a new plan: series, crime drama, territories UK and US, plus{' '}
            <mark className="rounded-sm bg-accent-soft px-1 text-accent">
              Canada (assumed, you did not name it)
            </mark>
            . Say “only the UK and US” to change it.
          </p>
          <div className="mk-in flex flex-col gap-3 rounded-2xl bg-inset p-4" style={stagger(1)}>
            <p className="text-[15.5px] font-semibold">Which of these is your series?</p>
            {[
              ['Night Ferry', 'Series, 2026, crime drama', true],
              ['Night Ferry', 'Film, 2019, documentary', false],
              ['None of these', 'Use comparable titles instead', false],
            ].map(([label, note, on]) => (
              <span
                key={`${label}${note}`}
                className={`flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 text-[14px] ${on ? 'border border-accent/40 bg-accent-soft' : 'bg-card'}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded-full ${on ? 'bg-accent text-accent-ink' : 'border-2 border-muted/40'}`}
                >
                  {on ? <Icon name="check" className="size-3" /> : null}
                </span>
                <span className="font-medium">{label}</span>
                <span className="text-muted sm:ml-auto">{note}</span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>
      <NextStep />
    </section>
  );
}

const tests: { belief: string; call: string; verdict: Verdict }[] = [
  { belief: 'Crime thriller fans are the core', call: 'call_8f3a', verdict: 'holds' },
  { belief: 'The UK should open first', call: 'call_2c71', verdict: 'breaks' },
  { belief: 'Seoul for a second wave', call: 'call_b904', verdict: 'weak' },
  { belief: 'Pre sales will cover the spend', call: 'no call', verdict: 'cant' },
];

export function Tests() {
  return (
    <section aria-label="Step 3" className={`relative bg-bg ${band} overflow-x-clip`}>
      <div className={`${wrap} flex flex-col gap-14`}>
        <div className="min-[1000px]:max-w-[62%]">
          <StepHead n={3} icon="search" title="It tests every assumption against real data.">
            <p>
              Each assumption in the plan becomes a question for the audience taste data. Code reads
              the values that come back and sets the verdict by a published rule. The model never
              sets a number.
            </p>
          </StepHead>
        </div>

        <Reveal className="overflow-hidden rounded-2xl bg-canvas">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-line px-5 py-3 text-[13px] font-medium text-muted max-[699px]:hidden">
            <span>Assumption in the plan</span>
            <span>Data lookup</span>
            <span>Verdict</span>
          </div>
          <ul>
            {tests.map((t, i) => (
              <li
                key={t.belief}
                className="mk-in grid items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4 last:border-0 min-[700px]:grid-cols-[1.4fr_1fr_1fr]"
                style={stagger(i)}
              >
                <span className="text-[15.5px] font-medium">{t.belief}</span>
                <span className="font-mono text-[12.5px] text-muted">{t.call}</span>
                <span>
                  <VerdictPill verdict={t.verdict} />
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
      <NextStep />
    </section>
  );
}

export function BottomLine() {
  return (
    <section aria-label="Step 4" className={`relative mk-lit bg-accent-soft ${band}`}>
      <div
        className={`${wrap} grid gap-14 min-[1000px]:grid-cols-[1.15fr_0.85fr] min-[1000px]:items-center`}
      >
        <Reveal className="order-2 flex flex-col gap-5 rounded-2xl bg-card p-[clamp(20px,3.4vw,40px)] shadow-md min-[1000px]:order-1">
          <p
            className="mk-in font-display text-[clamp(24px,2.6vw,32px)] leading-[1.15] font-semibold tracking-[-0.03em]"
            style={stagger(0)}
          >
            Open in Mexico City and London, then Toronto. Move the UK to week three.
          </p>
          <div className="mk-in flex flex-wrap items-center gap-3" style={stagger(1)}>
            <Confidence level="medium" />
            <span className="text-[14px] text-muted">Two cities have thin data.</span>
          </div>
          <span className="pt-2 text-[12.5px] font-medium text-muted">Do this</span>
          {[
            'Open in Mexico City and London in week one.',
            'Add Toronto in week two.',
            'Move the UK to week three.',
          ].map((step, i) => (
            <span
              key={step}
              className="mk-in flex items-center gap-3 rounded-xl bg-inset px-4 py-3 text-[15px]"
              style={stagger(i + 2)}
            >
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"
              >
                <Icon name="chevron" className="size-3.5 -rotate-90" />
              </span>
              <span className="min-w-0 flex-1">{step}</span>
              <span className="rounded-md bg-button px-2 py-0.5 text-xs">View receipt</span>
            </span>
          ))}
        </Reveal>
        <div className="order-1 min-[1000px]:order-2">
          <StepHead n={4} icon="flag" title="It ends with what to do first.">
            <p>
              Every answer opens with the bottom line, how sure Oraqul is in a word, and up to three
              steps. Each step links to its receipt. The full plan, every assumption and all the
              evidence sit one click down.
            </p>
          </StepHead>
        </div>
      </div>
      <NextStep />
    </section>
  );
}

export function KeepGoing() {
  return (
    <section aria-labelledby="keep-title" className={`scheme-dark bg-bg ${band}`}>
      <div className={`${wrap} flex flex-col gap-12`}>
        <h2 id="keep-title" className={`${h2Class} max-w-[18ch]`}>
          Then keep going in the chat.
        </h2>
        <div className="grid gap-4 min-[900px]:grid-cols-3">
          {[
            [
              'Ask for the next step',
              'Check rival dates, draft a partner brief, test a what if or make the creative kit, from the chips under the message box.',
            ],
            [
              'Correct it in words',
              '“Check my plan instead” runs a check. Naming new places plans again with them.',
            ],
            [
              'Bring your results',
              'After it is out, add results by region or age band and Oraqul finds what missed.',
            ],
          ].map(([title, text]) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl bg-card p-6">
              <h3 className="font-display text-[22px] font-semibold tracking-[-0.025em]">
                {title}
              </h3>
              <p className="text-[15px] leading-[1.55] text-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
