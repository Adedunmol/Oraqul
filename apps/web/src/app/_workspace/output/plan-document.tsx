'use client';

import type { LaunchLine, LaunchPlan, LineChange, PlanSource } from '@oraqul/schema';

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
  const rest = plan.sections.filter((s) => s.key !== 'bottom-line');
  return (
    <div className="flex flex-col gap-9">
      {inBrief ? (
        <section aria-labelledby="in-brief" className="flex flex-col gap-3">
          <h2
            id="in-brief"
            className="font-display text-[13px] font-semibold tracking-[0.04em] text-muted uppercase"
          >
            In brief
          </h2>
          <ol className="flex flex-col gap-3">
            {inBrief.lines.map((line, i) => (
              <li key={line.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-7 place-items-center rounded-lg bg-accent-soft font-mono text-[13px] font-semibold text-accent"
                >
                  {i + 1}
                </span>
                <p className="font-display text-[19px] leading-[1.4] font-medium tracking-[-0.01em]">
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
      <Review plan={plan} />
      <Assumed plan={plan} />
      {rest.map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
            {section.title}
          </h2>
          <Groups
            lines={section.lines}
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
 * What the red team made of the saved draft. A plan that passed gets a quiet line; one that did
 * not lists what is still open and what the person could give to settle it.
 */
function Review({ plan }: { plan: LaunchPlan }) {
  const review = plan.review;
  if (!review || review.status === 'unchecked') return null;
  const passed = review.status === 'passed';
  const open = review.rounds.at(-1)?.issues.filter((i) => i.blocking) ?? [];
  const drafts = review.rounds.length;
  return (
    <section aria-labelledby="review" className="flex flex-col gap-2">
      <h2 id="review" className="sr-only">
        Review
      </h2>
      <p
        className={`inline-flex w-fit items-center gap-1.5 rounded-md px-[9px] py-0.5 text-xs font-semibold ${passed ? 'bg-holds-bg text-holds' : 'bg-weak-bg text-weak'}`}
      >
        <span aria-hidden="true">{passed ? '✓' : '◐'}</span>
        {passed
          ? `Reviewed, passed${drafts > 1 ? ` after ${drafts} drafts` : ''}`
          : `Reviewed, ${open.length} open ${open.length === 1 ? 'point' : 'points'}`}
      </p>
      {!passed && open.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[14px] leading-[1.6] text-muted">
          {open.map((issue) => (
            <li key={`${issue.check}-${issue.text}`}>{issue.text}</li>
          ))}
        </ul>
      ) : null}
      {review.next.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-semibold">To make this stronger</h3>
          <ul className="flex flex-col gap-1 text-[14px] leading-[1.6] text-muted">
            {review.next.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** What the plan filled in because the brief did not say it, so a wrong guess is easy to spot. */
function Assumed({ plan }: { plan: LaunchPlan }) {
  const assumed = plan.understanding?.assumed ?? [];
  if (assumed.length === 0) return null;
  return (
    <section aria-labelledby="assumed" className="flex flex-col gap-2">
      <h2
        id="assumed"
        className="font-display text-[13px] font-semibold tracking-[0.04em] text-muted uppercase"
      >
        Assumed
      </h2>
      <ul className="flex flex-col gap-1 text-[14px] leading-[1.6] text-muted">
        {assumed.map((a) => (
          <li key={`${a.what}-${a.value}`}>
            <span className="text-ink">{a.value}</span>, because {a.why}
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
    <div className="flex flex-col gap-4">
      {groups.map((g, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a group name can repeat, so its place is the identity
        <div key={i} className="flex flex-col gap-1.5">
          {g.name ? <h3 className="text-[14px] font-semibold">{g.name}</h3> : null}
          <ul className="flex flex-col gap-2">
            {g.lines.map((line) => (
              <li
                key={line.id}
                className="relative pl-4 text-[15.5px] leading-[1.65] before:absolute before:top-[0.8em] before:left-0 before:size-1 before:rounded-full before:bg-muted"
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
