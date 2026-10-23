import { DirectionPill, VerdictPill } from '@oraqul/ui';
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
    prompt:
      'Plan the release of Night Ferry, a Nigerian crime drama, opening 12 March in Lagos, London and Houston. Independent budget.',
    gets: 'One plan per territory, home first. A calendar worked back from your date, one signal to judge it on, and partners that fit the budget.',
    brings:
      'A title, a release date and the cities. A budget band, comps and rivals make it sharper.',
    reply: 'Reading this as a new plan. Here is where to open, and what each territory needs.',
    preview: (
      <>
        <Row>
          Lagos, home market <DirectionPill direction="okay" />
        </Row>
        <Row>
          London, diaspora city <DirectionPill direction="okay" />
        </Row>
        <Row>
          Houston, diaspora city <DirectionPill direction="risky" />
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
    title: 'Keep going',
    prompt:
      'Rivals: Harbor Lights on 14 March; Third Mainland on 21 March. Then make the creative kit for Lagos.',
    gets: 'Rival dates checked against the audience they share, what ifs rerun on the plan, and the guides a team needs to make the creative.',
    brings: 'The rival releases and dates you are weighing.',
    reply: 'Here is each date against its rivals. Lower overlap is better.',
    preview: (
      <>
        <Row>
          Friday 14 March <DirectionPill direction="avoid" />
        </Row>
        <Row>
          Friday 21 March <DirectionPill direction="risky" />
        </Row>
        <Row>
          Friday 28 March <DirectionPill direction="okay" />
        </Row>
      </>
    ),
  },
  {
    id: 'fix',
    when: 'After launch day',
    title: 'Fix my plan',
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

export function Lifecycle() {
  return (
    <section aria-labelledby="life-title" className={band}>
      <div className={`${wrap} flex flex-col gap-14 min-[1000px]:gap-4`}>
        <div className="flex flex-col gap-5 min-[900px]:max-w-[62%]">
          <h2 id="life-title" className={h2Class}>
            Useful from the first idea to the week after launch.
          </h2>
          <p className={leadClass}>
            Start from what you have: a title and a date, a plan, or results that did not land. Then
            check the dates, test a what if and make the creative kit from the same chat.
          </p>
        </div>
        <StickySteps
          label="Three jobs and what comes after, in launch order"
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
