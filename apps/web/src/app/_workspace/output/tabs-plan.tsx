'use client';

import type { LaunchPlan } from '@oraqul/schema';
import { useEffect, useMemo, useState } from 'react';
import { useOutputView } from './context';
import { PlanDocument, PlanFollowUp, planOutline } from './plan-document';
import { PlanFeedback } from './plan-feedback';

/** The launch plan page: the document, in a reading column. Evidence is one click behind it. */
export function LaunchPlanTab({ plan }: { plan: LaunchPlan }) {
  const { output, openReceipt, shared, reaction } = useOutputView();
  const changes = useMemo(
    () => new Map(output.changes.map((c) => [c.lineId, c])),
    [output.changes],
  );
  return (
    <div className="grid grid-cols-1 gap-x-14 min-[1200px]:grid-cols-[minmax(0,720px)_220px]">
      <div className="flex flex-col gap-10">
        <PlanDocument plan={plan} changes={changes} onSource={(id) => openReceipt(id)} />
        {shared ? null : <PlanFollowUp plan={plan} />}
        {shared ? null : <PlanFeedback outputId={output.id} initial={reaction} />}
      </div>
      <Outline items={planOutline(plan)} />
    </div>
  );
}

// The sticky head and tabs cover about this much of the top, so a section counts as the one being
// read once its top passes under them.
const HEAD_OFFSET = 192;

/** The jump list. Lights the section being read, and the one just clicked until the scroll lands. */
function Outline({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | undefined>(items[0]?.id);

  useEffect(() => {
    const ids = items.map((i) => i.id);
    const read = () => {
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atEnd) return setActive(ids.at(-1));
      // The last section whose top has passed under the head; the first one before any has.
      let current = ids[0];
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= HEAD_OFFSET + 8) current = id;
      }
      setActive(current);
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [items]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-48 hidden h-fit flex-col gap-1 min-[1200px]:flex"
    >
      <p className="px-3 pb-1 text-[12px] font-semibold text-muted">On this page</p>
      {items.map((item) => {
        const on = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={on ? 'location' : undefined}
            onClick={() => setActive(item.id)}
            className={`truncate rounded-lg px-3 py-1.5 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none ${on ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'}`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
