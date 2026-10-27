'use client';

import { type Category, categories, type Project } from '@oraqul/schema';
import { buttonClassName, Card, Chip, Icon, PageHead } from '@oraqul/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Modal } from '@/app/(app)/_components/modal';
import type { Viewer } from '@/lib/api/viewer';
import { getCategory } from '@/lib/demo/catalog';
import { type CategoryScope, projectPath, projectsPath, startPath } from '@/lib/routes';
import { coverageColumns } from './category-coverage';
import { formatDay } from './format';
import { PinButton } from './pin-button';
import { CardShell, cardGridClass } from './project-card';

export function ProjectsScreen({
  scope,
  viewer,
  projects,
  pins,
}: {
  scope: CategoryScope;
  viewer: Viewer;
  /** The scope's projects, newest first. */
  projects: Project[];
  /** The person's pinned project ids, newest first. */
  pins: string[];
}) {
  const category: Category | undefined = scope === 'all' ? undefined : scope;
  const [query, setQuery] = useState('');
  const canEdit = viewer.role !== 'viewer';
  const info = category ? getCategory(category) : undefined;

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
  // Pinned first, in pin order, then the rest in list order. Search narrows both.
  const pinned = useMemo(
    () => pins.flatMap((id) => matches.filter((p) => p.id === id)),
    [pins, matches],
  );
  const others = useMemo(() => matches.filter((p) => !pins.includes(p.id)), [pins, matches]);

  return (
    <div className="view-enter flex flex-col gap-8" data-cat={category}>
      <PageHead
        className="sticky-head"
        title="Projects"
        action={
          canEdit ? <NewProject category={category} /> : <Chip>Viewers can read projects</Chip>
        }
      />
      <div className="flex min-w-0 items-center gap-2">
        <CategoryFilter scope={scope} />
        {info ? <CategoryHelp category={info.id} /> : null}
      </div>
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
              className="w-full rounded-lg border border-line bg-surface px-3 py-[9px] text-sm placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45"
            />
          </div>
          {pinned.length ? (
            <ProjectGroup
              id="pinned"
              title="Pinned"
              projects={pinned}
              pinned
              showCategory={!category}
              showTitle
            />
          ) : null}
          {others.length ? (
            <ProjectGroup
              id="projects"
              title="Projects"
              projects={others}
              pinned={false}
              showCategory={!category}
              showTitle={pinned.length > 0}
            />
          ) : null}
          {matches.length ? null : (
            <p className="rounded-xl bg-card p-7 text-center text-muted">No projects match.</p>
          )}
        </>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-7 text-center">
          <h2 className="font-display font-semibold">
            Start your first {info ? `${info.short.toLowerCase()} ` : ''}project
          </h2>
          <p className="max-w-md text-muted">
            Make a plan, check the plan you have, or fix one that missed. Oraqul sets up the project
            from your first message.
          </p>
          {canEdit ? <NewProject category={category} /> : null}
        </Card>
      )}
    </div>
  );
}

function NewProject({ category }: { category?: Category }) {
  return (
    <Link href={startPath({ category })} className={buttonClassName('primary', 'default', 'icon')}>
      <Icon name="plus" className="size-4" />
      New project
    </Link>
  );
}

// Categories are a filter on one list, not sections to choose first: the agent reads the category
// from the first message. Each is a link, so a category list keeps its own address.
function CategoryFilter({ scope }: { scope: CategoryScope }) {
  const items: { key: CategoryScope; label: string }[] = [
    { key: 'all', label: 'All' },
    ...categories.map((c) => ({
      key: c,
      label: getCategory(c).short,
    })),
  ];
  return (
    <nav
      aria-label="Filter by category"
      className="scroll-quiet flex min-w-0 max-w-full overflow-x-auto rounded-xl bg-surface2 p-1"
    >
      <ul className="flex gap-0.5">
        {items.map((item) => {
          const active = item.key === scope;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={projectsPath(item.key)}
                aria-current={active ? 'page' : undefined}
                data-cat={item.key === 'all' ? undefined : item.key}
                className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] min-[900px]:h-8 min-[900px]:px-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none ${active ? 'bg-card font-semibold text-ink' : 'text-muted hover:bg-surface2-hover hover:text-ink'}`}
              >
                {item.key === 'all' ? null : (
                  <Icon
                    name={item.key}
                    className={`size-3.5 text-cat ${active ? '' : 'opacity-80'}`}
                  />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ProjectGroup({
  id,
  title,
  projects,
  pinned,
  showCategory,
  showTitle,
}: {
  id: string;
  title: string;
  projects: Project[];
  pinned: boolean;
  showCategory: boolean;
  /** A heading only earns its place when there is a second group to tell this one from. */
  showTitle: boolean;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <h2
        id={`${id}-title`}
        className={showTitle ? 'text-[15px] font-semibold tracking-[-0.01em]' : 'sr-only'}
      >
        {title}
      </h2>
      <div className={cardGridClass}>
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} pinned={pinned} showCategory={showCategory} />
        ))}
      </div>
    </section>
  );
}

// A help button beside the filter: what Oraqul can and cannot do in one category, in a dialog, so
// the list stays about projects. The views it has, what it tests, what else it handles, and what
// the team brings. The same lists as the categories page.
function CategoryHelp({ category }: { category: Category }) {
  const info = getCategory(category);
  const [open, setOpen] = useState(false);
  const label = `What Oraqul tests in ${info.name}`;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={label}
        data-tip={label}
        onClick={() => setOpen(true)}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <Icon name="help" className="size-[18px]" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} wide>
        <CategoryDetails category={category} />
      </Modal>
    </>
  );
}

function CategoryDetails({ category }: { category: Category }) {
  const info = getCategory(category);
  const columns = coverageColumns(info);
  return (
    <div data-cat={category} className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_16%,var(--surface))] text-cat">
          <Icon name={category} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[13.5px] leading-[1.55] text-muted">{info.blurb}</p>
          <ul aria-label={`Views in ${info.name}`} className="flex flex-wrap gap-1.5">
            {info.tools.map((t) => (
              <li
                key={t}
                className="rounded-md bg-[color-mix(in_srgb,var(--cat)_16%,var(--surface))] px-2 py-0.5 text-[12px] font-medium"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 min-[700px]:grid-cols-3">
        {columns.map((c) => (
          <div key={c.title} className="flex min-w-0 flex-col gap-2.5">
            <div>
              <h3 className="font-display text-[13.5px] font-semibold">{c.title}</h3>
              <p className="text-[12px] text-muted">{c.note}</p>
            </div>
            <ul className="flex flex-col gap-2 text-[13px] leading-[1.45]">
              {c.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  pinned,
  showCategory,
}: {
  project: Project;
  pinned: boolean;
  showCategory: boolean;
}) {
  const info = getCategory(project.category);
  // Kind and genre say what it is. The window is in the chat, so the card does not repeat it.
  const meta = [showCategory ? info.short : '', project.kind, project.genre]
    .filter(Boolean)
    .join(' · ');
  return (
    <CardShell
      category={project.category}
      href={projectPath(project)}
      title={project.name}
      meta={meta}
      pin={
        <PinButton
          projectId={project.id}
          name={project.name}
          pinned={pinned}
          reveal
          className="relative z-10 -mt-1 -mr-1"
        />
      }
      footerStart={<Chip className="min-w-0 truncate bg-surface/70!">{project.status}</Chip>}
      footerEnd={`Updated ${formatDay(project.updatedAt)}`}
    />
  );
}
