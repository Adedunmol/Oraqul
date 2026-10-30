import {
  CALENDAR_RULES,
  GUIDE_INDEX,
  GUIDE_PAGES,
  type GuideSection,
  PARTNER_RULES,
  rules,
  SHOWS_PLAN_RULES,
  TIER_LABEL,
} from '@oraqul/packs';
import { categories } from '@oraqul/schema';
import { DirectionPill, VerdictPill } from '@oraqul/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { wrap } from '../section';
import { CATEGORY_GUIDE } from './brief';
import { PromptBuilder } from './prompt-builder';

const prose = 'max-w-[62ch] text-[17px] leading-[1.65] text-ink/80';
const h2 =
  'font-display text-[clamp(24px,2.6vw,32px)] leading-[1.1] font-semibold tracking-[-0.03em]';
const h3 = 'font-display text-[20px] font-semibold tracking-[-0.02em]';

/** The Guide's pages and what to ask on each, for the hub. */
export function GuideHub() {
  return (
    <div className={`${wrap} flex flex-col gap-16 py-[clamp(48px,7vw,96px)]`}>
      <section
        id="builder"
        aria-labelledby="builder-title"
        className="flex scroll-mt-24 flex-col gap-5"
      >
        <h2 id="builder-title" className={h2}>
          Build a brief, step by step
        </h2>
        <p className={prose}>
          Fill in what you know. The brief is written in the forms Oraqul reads without guessing,
          and the list beside it shows what is still missing and why it matters. Leave anything out:
          the plan says what it assumed.
        </p>
        <PromptBuilder />
      </section>
      <section aria-labelledby="pages-title" className="flex flex-col gap-5">
        <h2 id="pages-title" className={h2}>
          Read the guide
        </h2>
        <ul className="grid gap-3 min-[700px]:grid-cols-2 min-[1000px]:grid-cols-3">
          {GUIDE_INDEX.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/guide/${p.slug}`}
                className="flex h-full flex-col gap-2 rounded-2xl bg-card p-5 transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
              >
                <span className={h3}>{p.title}</span>
                <span className="text-[15.5px] leading-[1.65] text-ink/75">{p.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function GuideNav({ current }: { current: string }) {
  return (
    <nav aria-label="Guide pages" className="max-[999px]:hidden">
      <ol className="sticky top-24 flex flex-col gap-1 text-[14px]">
        <li>
          <Link
            href="/guide"
            className="block rounded-lg px-3 py-1.5 font-semibold hover:bg-surface2"
          >
            Guide
          </Link>
        </li>
        {GUIDE_INDEX.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/guide/${p.slug}`}
              aria-current={p.slug === current ? 'page' : undefined}
              className="block rounded-lg px-3 py-1.5 text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent motion-reduce:transition-none"
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Sections({
  sections,
  before,
}: {
  sections: GuideSection[];
  before?: Record<number, ReactNode>;
}) {
  return (
    <>
      {sections.map((s, i) => (
        <section
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of sections
          key={i}
          className="flex flex-col gap-5 border-t border-line pt-8 first:border-0 first:pt-0"
        >
          {s.heading ? <h2 className={h2}>{s.heading}</h2> : null}
          {s.text?.map((t) => (
            <p key={t} className={prose}>
              {t}
            </p>
          ))}
          {before?.[i]}
          {s.items && s.layout === 'cards' ? (
            <div className="grid gap-3 min-[800px]:grid-cols-2">
              {s.items.map((it) => (
                <div key={it.label} className="flex flex-col gap-2 rounded-2xl bg-card p-5">
                  <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em]">
                    {it.label}
                  </h3>
                  <p className="text-[15.5px] leading-[1.65] text-ink/80">{it.text}</p>
                  {it.note ? <p className="mt-auto text-[13px] text-muted">{it.note}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {s.items && s.layout === 'steps' ? (
            <ol className="flex flex-col gap-2">
              {s.items.map((it, n) => (
                <li
                  key={it.label}
                  className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 rounded-xl bg-card px-4 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-lg bg-accent-soft text-[13px] font-semibold text-accent tabular-nums"
                  >
                    {n + 1}
                  </span>
                  <span>
                    <b className="text-[15px]">{it.label}</b>
                    <span className="block text-[14px] text-muted">{it.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {s.items && s.layout === 'list' ? (
            <ul className="flex max-w-[62ch] flex-col gap-2.5 text-[16.5px] leading-[1.6] text-ink/80">
              {s.items.map((it) => (
                <li key={it.text}>
                  {it.label ? <b>{it.label} </b> : null}
                  {it.text}
                </li>
              ))}
            </ul>
          ) : null}
          {s.compare ? (
            <div className="overflow-hidden rounded-2xl bg-card">
              <table className="w-full border-collapse text-left text-[14.5px]">
                <thead>
                  <tr className="border-b border-line text-[13px] text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Detail
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Too loose
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Plans well
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.compare.map((r) => (
                    <tr key={r.label} className="border-b border-line align-top last:border-0">
                      <th scope="row" className="px-4 py-3 font-semibold">
                        {r.label}
                      </th>
                      <td className="px-4 py-3 text-muted">{r.weak}</td>
                      <td className="px-4 py-3">{r.strong}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}

function BuilderLink() {
  return (
    <Link href="/guide#builder" className="w-fit text-[16px] text-accent underline">
      Open the step by step brief builder
    </Link>
  );
}

function Pills() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictPill verdict="holds" />
        <VerdictPill verdict="weak" />
        <VerdictPill verdict="breaks" />
        <VerdictPill verdict="cant" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DirectionPill direction="okay" />
        <DirectionPill direction="risky" />
        <DirectionPill direction="avoid" />
      </div>
    </div>
  );
}

function CategoriesBody() {
  return (
    <div className="flex flex-col gap-5">
      <p className={prose}>
        Six categories, each judged on one signal and planned on the channels that lead for it.
      </p>
      <div className="grid gap-3 min-[800px]:grid-cols-2">
        {categories.map((c) => {
          const g = CATEGORY_GUIDE[c];
          const lib = rules[c];
          return (
            <div key={c} data-cat={c} className="flex flex-col gap-2.5 rounded-2xl bg-card p-5">
              <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                {g.name}
              </h3>
              <p className="text-[14.5px] text-ink/80">
                <b>Judged on:</b> {lib.signal.value.primary}.
              </p>
              <p className="text-[14.5px] text-ink/80">
                <b>Leads on:</b> {lib.channels.value.join(', ')}.
              </p>
              <p className="text-[14.5px] text-ink/80">
                <b>Also helps:</b> {g.extras.map((x) => x.label.toLowerCase()).join(', ')}.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RulesBody() {
  return (
    <div className="flex flex-col gap-6">
      <p className={prose}>
        Each category plans by a versioned set of rules. Every rule carries its source and the date
        it was set, and each plan records the version it used.
      </p>
      <div className="grid gap-3">
        {categories.map((c) => {
          const lib = rules[c];
          return (
            <div key={c} data-cat={c} className="flex flex-col gap-2 rounded-2xl bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                  {CATEGORY_GUIDE[c].name}
                </h3>
                <span className="font-mono text-[12px] text-muted">{lib.version}</span>
              </div>
              {lib.timeline.map((t) => (
                <p key={t.id} className="text-[14.5px] text-ink/80">
                  {t.value}
                  <span className="block text-[12.5px] text-muted">
                    {t.source.label}, {t.source.date}
                  </span>
                </p>
              ))}
              <p className="text-[14.5px] text-ink/80">
                Judged on {lib.signal.value.primary.toLowerCase()}.
                {lib.signal.value.benchmark
                  ? ` A target of ${lib.signal.value.benchmark.value.toLocaleString('en-US')} ${lib.signal.value.benchmark.unit}, with ${lib.signal.value.benchmark.floor?.toLocaleString('en-US')} as the floor.`
                  : ' Set your own target.'}
                <span className="block text-[12.5px] text-muted">
                  {lib.signal.source.label}, {lib.signal.source.date}
                </span>
              </p>
            </div>
          );
        })}
      </div>
      <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Live shows</h3>
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-5">
        <p className="text-[14.5px] text-ink/80">
          A single show or a short run is planned from the show date back. These are editable
          defaults, not facts.
        </p>
        <ul className="flex flex-col gap-2 text-[14.5px] text-ink/80">
          <li>
            <b>On sale.</b> General on sale opens about 4 to 6 weeks out for a comedy night, 6 to 10
            for an independent concert and 2 to 4 for a club night. Theatre and screenings were not
            researched, so you give the window and the plan marks it as yours.
          </li>
          <li>
            <b>Pacing.</b> Sales are back loaded: about{' '}
            {SHOWS_PLAN_RULES.pacing.value.comedyFirstWeek} percent of a comedy night sells in the
            first week and about {SHOWS_PLAN_RULES.pacing.value.comedyLastWeek} percent in the last,
            and across events about {SHOWS_PLAN_RULES.pacing.value.lastWeekAcrossEvents} percent
            sell in the final week. The target is always yours.
          </li>
          <li>
            <b>Presale.</b> It opens 3 to 7 days before general on sale behind an access code,
            registration stays open 4 to 7 days, and it always has an end date.
          </li>
          <li>
            <b>Budget.</b> 40, 20 and 40 percent across announce, middle and final push; 50, 10 and
            40 for comedy and last-minute shows. The final push is always held back.
          </li>
          <li>
            <b>Final push.</b> People who clicked a purchase link and did not buy, then people who
            opened earlier messages or registered, then the core audience. Ticket holders get show
            information, not sales messages.
          </li>
        </ul>
        <span className="block text-[12.5px] text-muted">
          {SHOWS_PLAN_RULES.onSale.source.label}; {SHOWS_PLAN_RULES.pacing.source.label}.{' '}
          {SHOWS_PLAN_RULES.pacing.source.caveat}
        </span>
      </div>
      <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
        Content calendar
      </h3>
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-5">
        <p className="text-[14.5px] text-ink/80">
          Every full plan has a content calendar, worked back from the date on each territory’s lead
          channel. Film and music follow blog-level guidance, one source for each point, so treat
          them as direction. Books, podcasts and games were not researched: their rows follow the
          launch beats and state no post counts.
        </p>
        {CALENDAR_RULES.ads.value.lines.map((line) => (
          <p key={line} className="text-[14.5px] text-ink/80">
            {line}
          </p>
        ))}
        <span className="block text-[12.5px] text-muted">{CALENDAR_RULES.ads.source.caveat}</span>
      </div>
      <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">Partner tiers</h3>
      <div className="grid gap-3 min-[800px]:grid-cols-3">
        {(['A', 'B', 'C'] as const).map((t) => (
          <div key={t} className="flex flex-col gap-1.5 rounded-2xl bg-card p-5">
            <b className="font-display text-[17px] tracking-[-0.02em]">
              Tier {t}, {TIER_LABEL[t].name}
            </b>
            <span className="text-[14px] text-ink/80">{TIER_LABEL[t].what}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-5">
        <p className="text-[14.5px] text-ink/80">{PARTNER_RULES.leadTime.value.why}</p>
        <p className="text-[14.5px] text-ink/80">{PARTNER_RULES.leadTime.value.independent}</p>
        <p className="text-[14.5px] text-ink/80">{PARTNER_RULES.leadTime.value.barter}</p>
        <p className="text-[14.5px] text-ink/80">{PARTNER_RULES.reach.value.solo}</p>
        <p className="text-[14.5px] text-ink/80">
          Partners are found from what your audience likes in Qloo, then ranked beside what the city
          likes on its own. A tier is set by what Qloo says about a brand: a flagship name or a
          brand ranked at the top of its popularity is tier A, and only a launch with the budget and
          the standing to approach one is offered it. A partner that does not fit the content, or
          that could draw fan backlash, is flagged beside the name. The pitch leaves the partner
          room to shape the idea.
        </p>
        <span className="block text-[12.5px] text-muted">
          {PARTNER_RULES.leadTime.source.label}, {PARTNER_RULES.leadTime.source.date}
        </span>
      </div>
    </div>
  );
}

function Body({ slug }: { slug: string }) {
  if (slug === 'categories') return <CategoriesBody />;
  if (slug === 'launch-rules') return <RulesBody />;
  const page = GUIDE_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  if (slug === 'write-a-brief') {
    return <Sections sections={page.sections} before={{ 0: <BuilderLink /> }} />;
  }
  if (slug === 'read-a-plan') {
    return <Sections sections={page.sections} before={{ 1: <Pills /> }} />;
  }
  return <Sections sections={page.sections} />;
}

/** One Guide page: the pages beside it, its content, a way to ask, and the page before and after. */
export function GuidePageBody({ slug }: { slug: string }) {
  const at = GUIDE_INDEX.findIndex((p) => p.slug === slug);
  const prev = GUIDE_INDEX[at - 1];
  const next = GUIDE_INDEX[at + 1];
  return (
    <div
      className={`${wrap} grid gap-12 py-[clamp(48px,7vw,96px)] min-[1000px]:grid-cols-[220px_minmax(0,1fr)]`}
    >
      <GuideNav current={slug} />
      <div className="flex min-w-0 flex-col gap-14">
        <Body slug={slug} />
        <nav
          aria-label="More in the guide"
          className="flex flex-wrap justify-between gap-4 text-[15px]"
        >
          {prev ? (
            <Link href={`/guide/${prev.slug}`} className="text-accent hover:underline">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/guide/${next.slug}`} className="text-accent hover:underline">
              {next.title} →
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
