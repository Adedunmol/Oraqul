import type { Category } from '@oraqul/schema';
import { Confidence, Icon, Kbd, Logo, VerdictPill } from '@oraqul/ui';
import { ReceiptCard } from '../receipt-card';
import { heroLines, planPrompt } from '../sample';

const projects: { cat: Category; name: string; on?: boolean }[] = [
  { cat: 'film', name: 'Harmattan', on: true },
  { cat: 'music', name: 'Lagos to London tour' },
  { cat: 'books', name: 'The Salt Road' },
  { cat: 'podcasts', name: 'Night Shift, season two' },
];

const steps = [
  'Open in Lagos and London in week one.',
  'Add Toronto in week two.',
  'Move the UK to week three.',
];

function Tile({ cat, size = 'size-6' }: { cat: Category; size?: string }) {
  return (
    <span
      data-cat={cat}
      className={`grid ${size} shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--cat)_16%,var(--surface))] text-cat`}
    >
      <Icon name={cat} className="size-3.5" />
    </span>
  );
}

function FakeReceipt() {
  return <span className="shrink-0 rounded-md bg-button px-2 py-0.5 text-xs">View receipt</span>;
}

/**
 * The app itself, drawn from the real components on invented data: the sidebar, a project's chat
 * and its summary. A picture, so screen readers get one sentence instead of the parts.
 */
export function AppPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[1180px]">
      <figcaption className="sr-only">
        A preview of the Oraqul app with example data: a film project, the chat that made its plan,
        and the plan's bottom line with three steps, each with a receipt.
      </figcaption>
      <div className="mk-stage" aria-hidden="true">
        <div className="mk-tilt overflow-hidden rounded-2xl bg-bg shadow-lg">
          <div className="grid min-[900px]:grid-cols-[208px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-1 p-3 max-[899px]:hidden">
              <div className="px-1.5 pt-1 pb-3">
                <Logo wordmarkClassName="text-[15px]" />
              </div>
              <span className="mb-2 flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-ink shadow-primary">
                <Icon name="plus" className="size-3.5" />
                New project
              </span>
              {(['overview', 'projects'] as const).map((name) => (
                <span
                  key={name}
                  className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted"
                >
                  <Icon name={name} className="size-4" />
                  {name === 'overview' ? 'Overview' : 'Projects'}
                </span>
              ))}
              <span className="px-2.5 pt-4 pb-1 text-[12.5px] font-medium text-muted">Pinned</span>
              {projects.map((p) => (
                <span
                  key={p.name}
                  className={`flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] ${p.on ? 'bg-accent-soft font-medium' : 'text-muted'}`}
                >
                  <Tile cat={p.cat} size="size-5" />
                  <span className="truncate">{p.name}</span>
                </span>
              ))}
            </aside>

            <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-canvas p-[clamp(12px,2vw,20px)] min-[900px]:my-2 min-[900px]:mr-2">
              <p className="text-[12.5px] text-muted">Projects › Film and series</p>
              <div className="flex items-center gap-3">
                <Tile cat="film" size="size-9" />
                <div className="min-w-0">
                  <p className="font-display text-[20px] font-semibold tracking-[-0.025em]">
                    Harmattan
                  </p>
                  <p className="truncate text-[12.5px] text-muted">
                    Film and series · Series · Crime drama
                  </p>
                </div>
              </div>

              <div className="grid gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
                  <p className="max-w-[90%] self-end rounded-xl bg-inset px-3 py-2 text-[13.5px]">
                    {planPrompt}
                  </p>
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
                    Oraqul
                  </span>
                  <p className="-mt-1.5 text-[14px] leading-[1.6]">
                    Reading this as a new plan: series, crime drama, UK and US. The UK is weaker
                    than it looks, so I moved it back and opened in Lagos and London.
                  </p>
                  <p className="flex items-center gap-2 rounded-lg bg-inset px-3 py-2 text-[12.5px] text-muted">
                    <Icon name="check" className="size-3.5 text-holds" />
                    Agent trace, 6 steps
                  </p>
                  <p className="flex items-center justify-between gap-2 rounded-lg bg-button px-3 py-2 text-[13px]">
                    <span className="truncate font-medium">Plan · Launch plan, first draft</span>
                    <span className="shrink-0 text-accent">Full details</span>
                  </p>
                  <div className="flex flex-col gap-2 rounded-lg bg-inset px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[12.5px]">
                      <span className="shimmer-text font-medium">
                        Checking rival release dates in March
                      </span>
                    </span>
                    <span className="mk-thinking block h-[2px] w-full rounded-full bg-surface2" />
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {['Draft a partner brief', 'Test a later date'].map((c) => (
                      <span key={c} className="rounded-md bg-button px-2.5 py-1 text-[12px]">
                        {c}
                      </span>
                    ))}
                  </div>
                  <span className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-muted">
                    Ask a follow up
                    <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-ink">
                      <Icon name="arrowUp" className="size-3.5" />
                    </span>
                  </span>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 max-[699px]:hidden">
                  <span className="text-[12.5px] font-medium text-muted">Bottom line</span>
                  <p className="font-display text-[19px] leading-[1.2] font-semibold tracking-[-0.025em]">
                    Open in Lagos and London, then Toronto. Move the UK to week three.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Confidence level="medium" />
                  </div>
                  <span className="pt-1 text-[12.5px] font-medium text-muted">Do this</span>
                  {steps.map((step, i) => (
                    <span
                      key={step}
                      className="flex items-center gap-2.5 rounded-xl bg-inset px-3 py-2.5 text-[13px]"
                    >
                      <Kbd>{i + 1}</Kbd>
                      <span className="min-w-0 flex-1">{step}</span>
                      <FakeReceipt />
                    </span>
                  ))}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <VerdictPill verdict="holds" />
                    <VerdictPill verdict="weak" />
                    <VerdictPill verdict="breaks" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute top-[46%] -right-10 w-[300px] rounded-2xl bg-card p-2.5 shadow-lg max-[1179px]:hidden"
      >
        <ReceiptCard line={heroLines[1]} />
      </div>
      <div
        aria-hidden="true"
        className="absolute bottom-[14%] -left-10 flex w-[260px] flex-col items-start gap-2 rounded-2xl bg-card p-4 shadow-lg max-[1179px]:hidden"
      >
        <VerdictPill verdict="holds" />
        <p className="text-[13.5px] font-medium">{heroLines[0].claim}</p>
      </div>
    </figure>
  );
}
