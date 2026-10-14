'use client';

import type { Category, Project } from '@oraqul/schema';
import { Card, Chip, Icon, PageHead } from '@oraqul/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Viewer } from '@/lib/api/viewer';
import { getCategory } from '@/lib/demo/catalog';
import { usePinnedProjects } from '@/lib/demo/pins';
import { listProjects } from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { type CategoryScope, projectPath } from '@/lib/routes';
import { DemoNote } from './demo-note';
import { formatDay, plural } from './format';
import { PinButton } from './pin-button';
import { StartButton } from './start-cards';

export function ProjectsScreen({ scope, viewer }: { scope: CategoryScope; viewer: Viewer }) {
  const category: Category | undefined = scope === 'all' ? undefined : scope;
  const state = useDemo();
  const [query, setQuery] = useState('');
  const canEdit = viewer.role !== 'viewer';
  const info = category ? getCategory(category) : undefined;
  const projects = listProjects(state, category);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      projects.filter(
        (p) =>
          !q ||
          `${p.name} ${p.kind} ${p.genre} ${getCategory(p.category).name}`
            .toLowerCase()
            .includes(q),
      ),
    [projects, q],
  );
  const pins = usePinnedProjects();
  // Pinned first, in pin order, then the rest in list order. Search narrows both.
  const pinned = useMemo(
    () => pins.flatMap((id) => matches.filter((p) => p.id === id)),
    [pins, matches],
  );
  const others = useMemo(() => matches.filter((p) => !pins.includes(p.id)), [pins, matches]);

  return (
    <div className="view-enter flex flex-col gap-8" data-cat={category}>
      <DemoNote />
      <PageHead
        label={viewer.teamName ?? undefined}
        title={info?.name ?? 'All projects'}
        action={
          canEdit ? <StartButton category={category} /> : <Chip>Viewers can read projects</Chip>
        }
      />
      {info ? <CategoryCard category={info.id} /> : null}
      {projects.length ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-search" className="text-xs text-muted">
              Search projects
            </label>
            <input
              id="project-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try a title, kind or genre"
              autoComplete="off"
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-[9px] text-sm placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45"
            />
          </div>
          {pinned.length ? (
            <ProjectGroup id="pinned" title="Pinned" projects={pinned} showCategory={!category} />
          ) : null}
          {others.length ? (
            <ProjectGroup
              id="projects"
              title={
                pinned.length
                  ? `Other projects · ${others.length}`
                  : plural(others.length, 'project')
              }
              projects={others}
              showCategory={!category}
            />
          ) : null}
          {matches.length ? null : (
            <p className="rounded-xl bg-card p-7 text-center text-muted">No projects match.</p>
          )}
        </>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-7 text-center">
          <h2 className="font-semibold">
            Start your first {info ? `${info.short.toLowerCase()} ` : ''}launch
          </h2>
          <p className="max-w-md text-muted">
            Plan a launch, check a plan you have, or rescue one that missed. Oraqul sets up the
            project from your first message.
          </p>
          {canEdit ? <StartButton category={category} worded /> : null}
        </Card>
      )}
    </div>
  );
}

function ProjectGroup({
  id,
  title,
  projects,
  showCategory,
}: {
  id: string;
  title: string;
  projects: Project[];
  showCategory: boolean;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <h2 id={`${id}-title`} className="text-[15px] font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} showCategory={showCategory} />
        ))}
      </div>
    </section>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const info = getCategory(category);
  return (
    <section
      aria-label={`About ${info.name}`}
      className="flex flex-col gap-4 rounded-2xl bg-card px-6 py-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
          <Icon name={category} className="size-5" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">What Oraqul tests in {info.name}</h2>
          <p className="text-[13px] text-muted">{info.blurb}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {info.tools.map((t) => (
          <span
            key={t}
            className="rounded-[7px] bg-accent-soft px-2.5 py-px text-[11px] font-semibold"
          >
            {t}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-5 gap-y-1.5 text-[13px] min-[900px]:grid-cols-3">
        {info.coverage.tests.map((t) => (
          <li key={t} className="flex gap-2">
            <Icon name="check" className="mt-px size-4 text-muted" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A project in the grid: tinted icon tile, title, kind, genre and window, then a footer with the
 * status and the last update. design-system §7.12. The title's link covers the card, so the
 * pin can sit on top of it without a button inside a link.
 */
function ProjectCard({ project, showCategory }: { project: Project; showCategory: boolean }) {
  const info = getCategory(project.category);
  const meta = [showCategory ? info.name : '', project.kind, project.genre, project.window]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      data-cat={project.category}
      className="group relative flex h-full flex-col rounded-2xl bg-card transition-colors duration-150 hover:bg-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
          <Icon name={project.category} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">
            <Link
              href={projectPath(project)}
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              {project.name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[13px] leading-[1.45] text-muted">{meta}</p>
        </div>
        <PinButton
          projectId={project.id}
          name={project.name}
          className="relative z-10 -mt-1 -mr-1"
        />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5 pt-1 pb-5 text-[12.5px] text-muted">
        <Chip className="min-w-0 truncate bg-surface!">{project.status}</Chip>
        <span className="shrink-0">Updated {formatDay(project.updatedAt)}</span>
      </div>
    </div>
  );
}
