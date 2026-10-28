import { Icon, type IconName } from '@oraqul/ui';
import { fitBand, fitH2, wrap } from '../section';

type Answer = 'yes' | 'partly' | 'no';

const answers: Record<Answer, { icon: IconName; word: string; tone: string }> = {
  yes: { icon: 'check', word: 'Yes', tone: 'text-holds' },
  partly: { icon: 'warning', word: 'Partly', tone: 'text-weak' },
  no: { icon: 'close', word: 'No', tone: 'text-breaks' },
};

// Each row is something the product does today. "Chatbots and AI planners" covers a chat model, a
// planner built on one and any wrapper around one: they share a source, the model's memory. A
// dashboard is the other thing a team uses, so it gets credit where it measures.
const rows: { ask: string; short: string; others: Answer; dashboard: Answer }[] = [
  {
    ask: 'Measures your audience in each city',
    short: 'Audience per city',
    others: 'no',
    dashboard: 'partly',
  },
  {
    ask: 'Numbers worked out by code, not written by a model',
    short: 'Numbers from code',
    others: 'no',
    dashboard: 'yes',
  },
  {
    ask: 'Every claim opens the data behind it',
    short: 'Claims show data',
    others: 'no',
    dashboard: 'yes',
  },
  {
    ask: 'Tests the plan you already have',
    short: 'Tests your plan',
    others: 'no',
    dashboard: 'no',
  },
  {
    ask: 'Follows the launch and revises the plan',
    short: 'Revises after launch',
    others: 'no',
    dashboard: 'partly',
  },
];

function Cell({ answer, strong = false }: { answer: Answer; strong?: boolean }) {
  const a = answers[answer];
  return (
    <span
      className={`flex flex-col items-center justify-center gap-1 px-1 py-3 text-[12px] font-medium min-[640px]:flex-row min-[640px]:gap-2 min-[640px]:text-[14px] ${a.tone} ${strong ? 'bg-accent-soft' : 'bg-card'}`}
    >
      <Icon name={a.icon} className="size-4" />
      {a.word}
    </span>
  );
}

/**
 * Where Oraqul sits among the things a team reaches for today. The comparison says only what the product does; it holds no measured figure.
 */
export function Difference() {
  return (
    <section aria-labelledby="difference-title" className={`${fitBand} bg-bg`}>
      <div className={`${wrap} flex flex-col gap-[clamp(28px,4.5svh,56px)]`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 id="difference-title" className={fitH2}>
            An agent that works the whole launch.
          </h2>
          <p className="max-w-[58ch] text-[clamp(16px,1.4vw,18px)] leading-[1.6] text-ink/75">
            Planning a launch today means reading articles, pulling dashboards and pasting into a
            chat that cannot show its sources. Oraqul does the research, the plan and the follow-up
            in one place, and shows its working.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-line">
          <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] min-[640px]:grid-cols-[1.5fr_1fr_1fr_1fr] gap-px">
            <span className="bg-card px-3 py-3 text-[12.5px] font-medium text-muted min-[640px]:px-5" />
            <span className="bg-card px-1 py-3 text-center text-[12px] leading-[1.3] font-medium text-muted min-[640px]:text-[13px]">
              <span className="min-[640px]:hidden">Chatbots, AI planners</span>
              <span className="max-[639px]:hidden">Chatbots and AI planners</span>
            </span>
            <span className="bg-card px-1 py-3 text-center text-[12px] leading-[1.3] font-medium text-muted min-[640px]:text-[13px]">
              <span className="min-[640px]:hidden">Dashboards</span>
              <span className="max-[639px]:hidden">Audience dashboards</span>
            </span>
            <span className="bg-accent-soft px-1 py-3 text-center text-[12px] leading-[1.3] font-semibold text-accent min-[640px]:text-[13px]">
              Oraqul
            </span>
            {rows.map((row) => (
              <div key={row.ask} className="col-span-4 grid grid-cols-subgrid gap-px">
                <span className="flex items-center bg-card px-3 py-3 text-[13.5px] leading-[1.35] font-medium min-[640px]:px-5 min-[640px]:text-[15.5px]">
                  <span className="min-[640px]:hidden">{row.short}</span>
                  <span className="max-[639px]:hidden">{row.ask}</span>
                </span>
                <Cell answer={row.others} />
                <Cell answer={row.dashboard} />
                <Cell answer="yes" strong />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
