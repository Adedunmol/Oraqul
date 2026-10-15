import { Chip, VerdictPill } from '@oraqul/ui';
import type { ReactNode } from 'react';
import { band, h2Class, leadClass, wrap } from '../section';
import { StickySteps } from '../sticky-steps';

interface Stage {
  id: string;
  when: string;
  title: string;
  prompt: string;
  gets: string;
  brings: string;
  reply: string;
  preview: ReactNode;
}

function Row({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-3 rounded-xl bg-inset px-5 py-4 text-[clamp(14.5px,1.2vw,17px)]">
      {children}
    </span>
  );
}

const stages: Stage[] = [
  {
    id: 'plan',
    when: 'Months out',
    title: 'Make a plan',
    prompt: 'Plan the release of Night Ferry, a Mexico City crime drama, for the UK and the US.',
    gets: 'The audience, comparable titles, where to open and in what order, and partner brands.',
    brings: 'A title and a short description.',
    reply: 'Reading this as a new plan. Here is where your audience is strongest.',
    preview: (
      <>
        <Row>
          Open in Mexico City and London <Chip>Recommended</Chip>
        </Row>
        <Row>
          Add Toronto in week two <Chip>Usable</Chip>
        </Row>
        <Row>
          Partner with a streaming night brand <Chip>Recommended</Chip>
        </Row>
      </>
    ),
  },
  {
    id: 'check',
    when: 'Before you commit',
    title: 'Check my plan',
    prompt: 'Check my plan: open in the UK, then Canada. Our core audience is women 25 to 34.',
    gets: 'Every belief in the plan marked, with a stronger option wherever one breaks.',
    brings: 'Your plan, pasted or as a file.',
    reply: 'I tested 4 beliefs in your plan. One breaks, and here is a stronger option.',
    preview: (
      <>
        <Row>
          Women 25 to 34 are the core <VerdictPill verdict="holds" />
        </Row>
        <Row>
          Open in the UK first <VerdictPill verdict="breaks" />
        </Row>
        <span className="w-fit rounded-lg bg-accent-soft px-4 py-2.5 text-[clamp(14px,1.2vw,16px)] font-medium text-accent">
          Stronger option: open in Canada first
        </span>
      </>
    ),
  },
  {
    id: 'whatif',
    when: 'Weeks out',
    title: 'Test a what if',
    prompt: 'What if a rival series opens the same weekend?',
    gets: 'How each date overlaps with rival releases, and what moves in the plan.',
    brings: 'The dates or options you are weighing.',
    reply: 'Here is the overlap for each Friday. Lower is better.',
    preview: (
      <>
        <Row>
          Friday 14 March <Chip>Low overlap</Chip>
        </Row>
        <Row>
          Friday 21 March <Chip>Moderate overlap</Chip>
        </Row>
        <Row>
          Friday 28 March <Chip>Risky overlap</Chip>
        </Row>
      </>
    ),
  },
  {
    id: 'fix',
    when: 'After launch day',
    title: 'Fix one that missed',
    prompt: 'It missed. Here are our results by age band.',
    gets: 'Who came against who the plan expected, the belief that broke, and a plan built around them.',
    brings: 'Your results by region or age band.',
    reply: 'The plan bet on 25 to 34. The people who came were 35 to 44.',
    preview: (
      <span className="flex flex-col gap-4 rounded-xl bg-inset px-5 py-5 text-[clamp(14px,1.2vw,16px)]">
        {(
          [
            ['Planned: ages 25 to 34', '55%', 'bg-muted'],
            ['Came: ages 35 to 44', '60%', 'bg-accent'],
          ] as const
        ).map(([label, width, fill]) => (
          <span key={label} className="flex flex-col gap-1.5">
            {label}
            <span className="h-2 rounded-sm bg-surface2">
              <span className={`block h-full rounded-sm ${fill}`} style={{ width }} />
            </span>
          </span>
        ))}
      </span>
    ),
  },
];

function StageText({ stage }: { stage: Stage }) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="font-display text-[clamp(30px,3.4vw,46px)] leading-[1.02] font-semibold tracking-[-0.04em]">
        {stage.title}
      </h3>
      <p className="max-w-[40ch] text-[18px] leading-[1.55] text-ink/75">{stage.gets}</p>
      <p className="flex flex-col gap-1.5 text-[15px]">
        <span>
          <span className="font-semibold">When: </span>
          <span className="text-ink/75">{stage.when}</span>
        </span>
        <span>
          <span className="font-semibold">You bring: </span>
          <span className="text-ink/75">{stage.brings}</span>
        </span>
      </p>
    </div>
  );
}

/** The chat for one job: the person's message, the agent's reply, and what it produced. */
function StageVisual({ stage }: { stage: Stage }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-card p-[clamp(22px,3.6vw,48px)] shadow-lg">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold">{stage.title}</span>
        <span className="rounded-md bg-surface2 px-2 py-0.5 text-[12.5px] font-medium text-muted">
          Example
        </span>
      </div>
      <p className="max-w-[88%] self-end rounded-xl bg-inset px-5 py-4 text-[clamp(15px,1.3vw,18px)] leading-[1.5]">
        {stage.prompt}
      </p>
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent">
        Oraqul
      </span>
      <p className="-mt-2 text-[clamp(16px,1.4vw,19px)] leading-[1.55]">{stage.reply}</p>
      <div className="flex flex-col gap-2.5">{stage.preview}</div>
    </div>
  );
}

/**
 * The four jobs in the order they happen around a launch, told as sticky steps: the jobs scroll
 * past while the chat for the one in the middle of the screen stays pinned beside them.
 */
export function Lifecycle() {
  return (
    <section aria-labelledby="life-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14 min-[1000px]:gap-4`}>
        <div className="flex flex-col gap-5 min-[900px]:max-w-[62%]">
          <h2 id="life-title" className={h2Class}>
            Useful from the first idea to the week after launch.
          </h2>
          <p className={leadClass}>
            Start from what you have: a title, a plan, a worry about a date, or results that did not
            land.
          </p>
        </div>
        <StickySteps
          label="Four jobs, in launch order"
          steps={stages.map((stage) => ({
            id: stage.id,
            text: <StageText stage={stage} />,
            visual: <StageVisual stage={stage} />,
          }))}
        />
      </div>
    </section>
  );
}
