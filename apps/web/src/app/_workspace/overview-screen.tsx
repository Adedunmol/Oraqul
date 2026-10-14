'use client';

import { Chip, Icon, PageHead } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { Viewer } from '@/lib/api/viewer';
import { getOverview, type NeedsYouItem, type RecentThread } from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { projectPath } from '@/lib/routes';
import { DemoNote } from './demo-note';
import { plural } from './format';
import { StartCards } from './start-cards';

const sectionTitle = 'text-[15px] font-semibold tracking-[-0.01em]';
const emptyBox = 'flex items-center gap-3 rounded-2xl bg-card px-5 py-5 text-[13.5px] text-muted';
const rowClass =
  'relative flex min-w-0 items-center gap-3 rounded-2xl bg-card px-4 py-3.5 transition-colors hover:bg-card-hover motion-reduce:transition-none';
// The row's link covers the whole row, so the row reads as one target and a pin button can sit
// on top of it without nesting a button inside a link.
const coverLink =
  'min-w-0 flex-1 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent';

/** The team's home: ways to start, what needs a person, and threads to pick up. */
export function OverviewScreen({ viewer }: { viewer: Viewer }) {
  const state = useDemo();
  const overview = useMemo(() => getOverview(state), [state]);
  const canEdit = viewer.role !== 'viewer';

  return (
    <div className="view-enter flex flex-col gap-10">
      <DemoNote />
      <PageHead
        label={viewer.teamName ?? undefined}
        title="Overview"
        action={canEdit ? undefined : <Chip>Viewers can read projects</Chip>}
      />
      {canEdit ? (
        <Section id="start" title="Start here">
          <StartCards />
        </Section>
      ) : null}

      <Section id="needs" title="Needs you" count={overview.needsYou.length}>
        {overview.needsYou.length ? (
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
            {overview.needsYou.map((item) => (
              <NeedRow key={needKey(item)} item={item} />
            ))}
          </div>
        ) : (
          <p className={emptyBox}>
            <Icon name="check" className="text-muted" />
            You are all caught up.
          </p>
        )}
      </Section>

      {overview.threads.length ? (
        <Section id="threads" title="Pick up where you left off">
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
            {overview.threads.map((t) => (
              <ThreadRow key={t.thread.id} recent={t} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-4">
      <h2 id={`${id}-title`} className={`${sectionTitle} flex items-center gap-2`}>
        {title}
        {count ? (
          <span className="rounded-full bg-surface2 px-2 text-[12px] font-semibold tabular-nums text-muted">
            {count}
          </span>
        ) : null}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

const needKey = (n: NeedsYouItem): string =>
  n.reason === 'results' ? `results:${n.project.id}` : `${n.reason}:${n.thread.id}`;

const NEED_ACTION: Record<NeedsYouItem['reason'], string> = {
  answer: 'Answer',
  results: 'Add results',
  ready: 'Open',
  working: 'Watch',
};

function NeedRow({ item }: { item: NeedsYouItem }) {
  const action = NEED_ACTION[item.reason];
  const href = item.reason === 'results' ? projectPath(item.project) : `/threads/${item.thread.id}`;
  let title = '';
  let detail = '';
  if (item.reason === 'answer') {
    title = `${item.thread.name} is waiting for you`;
    detail = item.prompt;
  } else if (item.reason === 'results') {
    title = `${item.project.name} is out`;
    detail = 'Add its results to see who really came.';
  } else if (item.reason === 'ready') {
    title = `Something new in ${item.thread.name}`;
    detail = item.project.name;
  } else {
    title = `Oraqul is working on ${item.thread.name}`;
    detail = item.project.name;
  }
  return (
    <div className={rowClass} data-cat={item.project.category}>
      <CategoryTile category={item.project.category} />
      <Link href={href} className={coverLink}>
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-[13px] text-muted">{detail}</span>
      </Link>
      <span
        className={`shrink-0 rounded-[8px] px-2.5 py-1 text-[12.5px] font-medium ${item.reason === 'answer' ? 'bg-accent-soft text-accent' : 'bg-surface2 text-ink'}`}
      >
        {item.reason === 'working' ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
            />
            {action}
          </span>
        ) : (
          action
        )}
      </span>
    </div>
  );
}

function ThreadRow({ recent }: { recent: RecentThread }) {
  const { thread, project, outputCount } = recent;
  return (
    <div className={rowClass} data-cat={project.category}>
      <CategoryTile category={project.category} />
      <Link href={`/threads/${thread.id}`} className={coverLink}>
        <span className="block truncate text-sm font-semibold">{thread.name}</span>
        <span className="block truncate text-[13px] text-muted">
          {project.name} · {plural(outputCount, 'output')}
        </span>
      </Link>
    </div>
  );
}

function CategoryTile({ category }: { category: NeedsYouItem['project']['category'] }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
      <Icon name={category} className="size-4" />
    </span>
  );
}
