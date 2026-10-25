'use client';

import type { LaunchLine, LaunchPlan, LineChange, PlanSource } from '@oraqul/schema';
import type { ReactNode } from 'react';
import { CalendarTable } from './calendar-table';
import { PlanFrame } from './plan-frame';

/** Finding ids in the order the plan first cites them, numbered from 1, as in the exports. */
export function footnotes(plan: LaunchPlan): Map<string, number> {
  return footnotesOf(plan.sections.flatMap((s) => s.lines));
}

/** The same numbering for any lines, such as the ones an audit report is made of. */
export function footnotesOf(lines: LaunchLine[]): Map<string, number> {
  const order = new Map<string, number>();
  for (const line of lines) {
    for (const id of [...line.findingIds, ...line.sourceIds]) {
      if (!order.has(id)) order.set(id, order.size + 1);
    }
  }
  return order;
}

/** The plan's sections as a jump list, in the order the document shows them. */
export function planOutline(plan: LaunchPlan): { id: string; label: string }[] {
  const brief = plan.sections.find((s) => s.key === 'bottom-line');
  return [
    ...(brief ? [{ id: 'in-brief', label: 'In brief' }] : []),
    ...((plan.understanding?.assumed.length ?? 0) > 0 ? [{ id: 'assumed', label: 'Assumed' }] : []),
    ...plan.sections
      .filter((s) => s.key !== 'bottom-line' && s.key !== 'gaps')
      .map((s) => ({ id: `plan-${s.key}`, label: s.title })),
  ];
}

const sectionTitle = 'font-display text-[20px] font-semibold tracking-[-0.015em]';

/**
 * The launch plan as a document, used in the chat and on the plan page. What a line rests on is a
 * quiet number that opens the evidence.
 */
export function PlanDocument({
  plan,
  changes,
  onSource,
}: {
  plan: LaunchPlan;
  /** Lines that differ from the plan this one was built on, by line id. */
  changes?: Map<string, LineChange>;
  /** Opens what a numbered line rests on. */
  onSource: (findingId: string) => void;
}) {
  const notes = footnotes(plan);
  const inBrief = plan.sections.find((s) => s.key === 'bottom-line');
  const rest = plan.sections.filter((s) => s.key !== 'bottom-line' && s.key !== 'gaps');
  return (
    <div className="font-read flex flex-col gap-10 text-[16px] leading-[1.72]">
      {inBrief ? (
        <section aria-labelledby="in-brief" className="flex scroll-mt-48 flex-col gap-4">
          <h2 id="in-brief" className={sectionTitle}>
            In brief
          </h2>
          <ol className="flex flex-col gap-4">
            {inBrief.lines.map((line, i) => (
              <li key={line.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
                <span aria-hidden="true" className="pt-0.5 text-[13px] font-semibold text-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-[18px] leading-[1.55] font-medium">
                  <LineText
                    line={line}
                    notes={notes}
                    sources={plan.sources}
                    changes={changes}
                    onSource={onSource}
                  />
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <PlanFrame plan={plan} />
      <Assumed plan={plan} />
      {rest.map((section) => (
        <section
          key={section.key}
          id={`plan-${section.key}`}
          className="flex scroll-mt-48 flex-col gap-4 border-t border-line pt-8"
        >
          <h2 className={sectionTitle}>{section.title}</h2>
          {section.key === 'calendar' && plan.calendar.length > 0 ? (
            <CalendarTable rows={plan.calendar} />
          ) : null}
          <Groups
            lines={
              section.key === 'calendar' && plan.calendar.length > 0
                ? section.lines.filter((l) => !plan.calendar.some((r) => r.id === l.id))
                : section.lines
            }
            notes={notes}
            sources={plan.sources}
            changes={changes}
            onSource={onSource}
          />
          {section.key === 'positioning' ? <Comps plan={plan} /> : null}
        </section>
      ))}
    </div>
  );
}

/**
 * What the red team made of the saved draft: whether it passed, what is still open and what the
 * person could give to settle it. It is advice about the plan, not part of it, so it sits beneath
 * the plan's card and never inside it. Renders nothing when there is nothing to say.
 */
export function PlanFollowUp({ plan }: { plan: LaunchPlan }) {
  const gaps = plan.sections.find((s) => s.key === 'gaps');
  const review = plan.review?.status === 'unchecked' ? null : plan.review;
  if (!gaps?.lines.length && !review) return null;
  return (
    <FollowUp label="Review of this plan">
      {gaps?.lines.length ? (
        <div className="flex flex-col gap-2.5">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
            {gaps.title}
          </h2>
          <FollowUpList items={gaps.lines.map((l) => ({ key: l.id, text: l.text }))} />
        </div>
      ) : null}
      {review ? <Review review={review} /> : null}
    </FollowUp>
  );
}

function Review({ review }: { review: NonNullable<LaunchPlan['review']> }) {
  const passed = review.status === 'passed';
  const open = review.rounds.at(-1)?.issues.filter((i) => i.blocking) ?? [];
  const drafts = review.rounds.length;
  return (
    <>
      <p
        className={`inline-flex w-fit items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold ${passed ? 'bg-holds-bg text-holds' : 'bg-weak-bg text-weak'}`}
      >
        <span aria-hidden="true">{passed ? '✓' : '◐'}</span>
        {passed
          ? `Reviewed, passed${drafts > 1 ? ` after ${drafts} drafts` : ''}`
          : `Reviewed, ${open.length} open ${open.length === 1 ? 'point' : 'points'}`}
      </p>
      {!passed && open.length > 0 ? (
        <FollowUpList items={open.map((i) => ({ key: `${i.check}-${i.text}`, text: i.text }))} />
      ) : null}
      {review.next.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[14px] font-semibold">To make this stronger</h3>
          <FollowUpList items={review.next.map((n) => ({ key: n, text: n }))} />
        </div>
      ) : null}
    </>
  );
}

/** The frame for advice that belongs beneath an output: no card, so it reads as a reply to it. */
export function FollowUp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 px-1.5">
      {children}
    </section>
  );
}

export function FollowUpList({ items }: { items: { key: string; text: string }[] }) {
  return (
    <ul className="font-read flex flex-col gap-1.5 text-[16px] leading-[1.65] text-muted">
      {items.map((item) => (
        <li
          key={item.key}
          className="relative pl-4 before:absolute before:top-[0.75em] before:left-0 before:size-1 before:rounded-full before:bg-muted"
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
}

/** The reason arrives as a sentence; after "because" it reads as a clause. */
const lowerFirst = (text: string) => text.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase());

/** What the plan filled in because the brief did not say it, so a wrong guess is easy to spot. */
function Assumed({ plan }: { plan: LaunchPlan }) {
  const assumed = plan.understanding?.assumed ?? [];
  if (assumed.length === 0) return null;
  return (
    <section aria-labelledby="assumed" className="flex scroll-mt-48 flex-col gap-4">
      <h2 id="assumed" className={sectionTitle}>
        Assumed
      </h2>
      <ul className="flex flex-col gap-1.5 text-[16px] leading-[1.65] text-muted">
        {assumed.map((a) => (
          <li key={`${a.what}-${a.value}`}>
            <span className="text-ink">{a.value.replaceAll('_', ' ')}</span>, because{' '}
            {lowerFirst(a.why)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Groups({
  lines,
  notes,
  sources,
  changes,
  onSource,
}: {
  lines: LaunchLine[];
  notes: Map<string, number>;
  sources: PlanSource[];
  changes?: Map<string, LineChange>;
  onSource: (findingId: string) => void;
}) {
  const groups: { name: string | null; lines: LaunchLine[] }[] = [];
  for (const line of lines) {
    const last = groups.at(-1);
    if (last && last.name === line.group) last.lines.push(line);
    else groups.push({ name: line.group, lines: [line] });
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a group name can repeat, so its place is the identity
        <div key={i} className="flex flex-col gap-2">
          {g.name ? <h3 className="text-[14.5px] font-semibold">{g.name}</h3> : null}
          <ul className="flex flex-col gap-2.5">
            {g.lines.map((line) => (
              <li
                key={line.id}
                className="relative pl-4 text-[16px] leading-[1.7] before:absolute before:top-[0.9em] before:left-0 before:size-1 before:rounded-full before:bg-muted"
              >
                <LineText
                  line={line}
                  notes={notes}
                  sources={sources}
                  changes={changes}
                  onSource={onSource}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function LineText({
  line,
  notes,
  sources,
  changes,
  onSource,
}: {
  line: LaunchLine;
  notes: Map<string, number>;
  sources: PlanSource[];
  changes?: Map<string, LineChange>;
  onSource: (findingId: string) => void;
}) {
  const change = changes?.get(line.id);
  return (
    <>
      {change ? (
        <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-px align-middle text-[11px] font-semibold text-accent">
          {change.before === null ? 'New' : 'Updated'}
        </span>
      ) : null}
      {line.text}
      {line.sourceIds.map((id) => {
        const source = sources.find((x) => x.id === id);
        return source ? (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Source: ${source.title}`}
            data-tip={source.title}
            className="ml-1 align-super text-[11px] leading-none text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
          >
            {notes.get(id)}
          </a>
        ) : null;
      })}
      {line.findingIds.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onSource(id)}
          aria-label="See what this is based on"
          data-tip="What this is based on"
          className="ml-1 align-super text-[11px] leading-none text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
        >
          {notes.get(id)}
        </button>
      ))}
      {change?.before ? (
        <span className="mt-0.5 block text-[13px] text-muted">Was: {change.before}</span>
      ) : null}
    </>
  );
}

function Comps({ plan }: { plan: LaunchPlan }) {
  const added = plan.comps.filter((c) => c.source === 'added');
  if (added.length === 0) return null;
  return (
    <p className="text-[13px] text-muted">
      Planned against {added.map((c) => c.name).join(', ')}. Name your own comparable titles in the
      chat to swap them.
    </p>
  );
}
