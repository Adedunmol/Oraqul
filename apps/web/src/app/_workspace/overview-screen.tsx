'use client';

import type { NeedsYouItem, Overview, RecentThread } from '@oraqul/schema';
import { Chip, Icon, PageHead } from '@oraqul/ui';
import type { ReactNode } from 'react';
import type { Viewer } from '@/lib/api/viewer';
import { getCategory } from '@/lib/demo/catalog';
import { projectPath } from '@/lib/routes';
import { formatDay, plural } from './format';
import { CardShell, cardGridClass } from './project-card';
import { StartComposer } from './start-composer';

const sectionTitle = 'text-[15px] font-semibold tracking-[-0.01em]';
const emptyBox = 'flex items-center gap-3 rounded-2xl bg-card px-5 py-5 text-[13.5px] text-muted';
export function OverviewScreen({ viewer, overview }: { viewer: Viewer; overview: Overview }) {
  const canEdit = viewer.role !== 'viewer' && viewer.teamId !== null;

  return (
    <div className="view-enter flex flex-col gap-10">
      <PageHead
        className="sticky-head"
        title="Overview"
        action={canEdit ? undefined : <Chip>Viewers can read projects</Chip>}
      />
      {canEdit ? (
        <Section id="start" title="What are you working on?">
          {viewer.teamId ? <StartComposer teamId={viewer.teamId} /> : null}
        </Section>
      ) : null}

      <Section id="needs" title="Needs you" count={overview.needsYou.length}>
        {overview.needsYou.length ? (
          <div className={cardGridClass}>
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
          <div className={cardGridClass}>
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
      <h2 id={`${id}-title`} className={`font-display ${sectionTitle} flex items-center gap-2`}>
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
  const category = getCategory(item.project.category).short;
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
    <CardShell
      category={item.project.category}
      href={href}
      title={title}
      meta={`${category} · ${detail}`}
      footerStart={
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium ${item.reason === 'answer' ? 'bg-primary text-primary-ink' : 'bg-surface/70 text-ink'}`}
        >
          {item.reason === 'working' ? (
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
            />
          ) : null}
          {action}
        </span>
      }
    />
  );
}

function ThreadRow({ recent }: { recent: RecentThread }) {
  const { thread, project, outputCount } = recent;
  return (
    <CardShell
      category={project.category}
      href={`/threads/${thread.id}`}
      title={thread.name}
      meta={`${getCategory(project.category).short} · ${project.name} · ${plural(outputCount, 'output')}`}
      footerStart={<Chip className="min-w-0 truncate bg-surface/70!">{project.status}</Chip>}
      footerEnd={`Updated ${formatDay(project.updatedAt)}`}
    />
  );
}
