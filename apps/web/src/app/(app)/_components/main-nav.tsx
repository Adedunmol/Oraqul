'use client';

import type { Project } from '@oraqul/schema';
import { Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useMemo } from 'react';
import { usePinnedProjects } from '@/lib/demo/pins';
import { getOverview } from '@/lib/demo/queries';
import type { DemoState } from '@/lib/demo/store';
import { useDemo } from '@/lib/demo/use-demo';
import { overviewPath, projectPath, projectsPath, startPath } from '@/lib/routes';
import { navCountClass, navItemActive, navItemClass, navItemIdle } from './nav-link';

const RECENT = 5;

const groupLabel = 'px-3 text-[12px] font-semibold text-muted rail:sr-only';

/** The project the current page belongs to, so its sidebar row stays lit inside it. */
function currentProjectId(pathname: string, s: DemoState): string | undefined {
  const [, section, id, , projectId] = pathname.split('/');
  if (section === 'categories') return projectId;
  if (section === 'threads') return s.threads.find((t) => t.id === id)?.projectId;
  if (section === 'outputs') return s.outputs.find((o) => o.id === id)?.projectId;
  return undefined;
}

function Item({
  href,
  icon,
  label,
  count,
  active,
}: {
  href: string;
  icon: IconName;
  label: string;
  /** A count on the right, hidden at zero. `label` says what is counted, for screen readers. */
  count?: { value: number; label: string };
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      data-rail-tip={label}
      className={`${navItemClass} ${active ? navItemActive : navItemIdle}`}
    >
      <Icon name={icon} />
      <span className="rail:sr-only">{label}</span>
      {count?.value ? (
        <span className={navCountClass}>
          {count.value}
          <span className="sr-only"> {count.label}</span>
        </span>
      ) : null}
    </Link>
  );
}

/** One project row: its category tile, so the list reads at a glance and in the rail. */
function ProjectItem({ project, active }: { project: Project; active: boolean }) {
  return (
    <Link
      href={projectPath(project)}
      data-cat={project.category}
      aria-current={active ? 'page' : undefined}
      data-rail-tip={project.name}
      className={`${navItemClass} ${active ? navItemActive : navItemIdle}`}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
        <Icon name={project.category} className="size-3.5" />
      </span>
      <span className="min-w-0 truncate rail:sr-only">{project.name}</span>
    </Link>
  );
}

function ProjectGroup({
  title,
  projects,
  current,
}: {
  title: string;
  projects: Project[];
  current: string | undefined;
}) {
  if (!projects.length) return null;
  return (
    <div className="flex flex-col gap-0.5 rail:pt-3">
      <p className={groupLabel}>{title}</p>
      {projects.map((p) => (
        <ProjectItem key={p.id} project={p} active={p.id === current} />
      ))}
    </div>
  );
}

/**
 * New project, Overview and Projects, then the person's pinned and recent projects, so the way
 * back into work is one click. Categories are a filter on the project list, not nav.
 */
export function MainNav() {
  const s = useDemo();
  const pathname = usePathname();
  const pins = usePinnedProjects();
  const needsYou = useMemo(() => getOverview(s).needsYou.length, [s]);
  const current = currentProjectId(pathname, s);
  const pinned = useMemo(
    () => pins.flatMap((id) => s.projects.filter((p) => p.id === id)),
    [pins, s.projects],
  );
  const recent = useMemo(
    () =>
      s.projects
        .filter((p) => !pins.includes(p.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, RECENT),
    [pins, s.projects],
  );
  // Projects lights on the list pages, and inside a project that has no row of its own here.
  const shown = current !== undefined && [...pinned, ...recent].some((p) => p.id === current);
  const inProjects = current === undefined ? pathname.startsWith('/categories/') : !shown;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href={startPath()}
          data-rail-tip="New project"
          aria-current={pathname === '/start' ? 'page' : undefined}
          className={`${navItemClass} mb-2 border border-primary bg-primary font-semibold text-primary-ink shadow-primary hover:bg-primary-hover`}
        >
          <Icon name="plus" />
          <span className="rail:sr-only">New project</span>
        </Link>
        <Item
          href={overviewPath}
          icon="overview"
          label="Overview"
          count={{ value: needsYou, label: 'need you' }}
          active={pathname === overviewPath}
        />
        <Item href={projectsPath()} icon="projects" label="Projects" active={inProjects} />
      </div>
      <ProjectGroup title="Pinned" projects={pinned} current={current} />
      <ProjectGroup title="Recent" projects={recent} current={current} />
    </>
  );
}

/** Below 900px the sidebar becomes a top bar with the few main items. design-system §6 */
export function MobileNav({ search }: { search: ReactNode }) {
  const pathname = usePathname();
  const links: { href: string; icon: IconName; label: string; active: boolean }[] = [
    { href: startPath(), icon: 'plus', label: 'New', active: pathname === '/start' },
    { href: overviewPath, icon: 'overview', label: 'Overview', active: pathname === overviewPath },
    {
      href: projectsPath(),
      icon: 'projects',
      label: 'Projects',
      active: pathname.startsWith('/categories/'),
    },
  ];
  const team = {
    href: '/team',
    icon: 'team',
    label: 'Team',
    active: pathname.startsWith('/team'),
  } as const;
  const item = (l: { href: string; icon: IconName; label: string; active: boolean }) => (
    <Link
      key={l.href}
      href={l.href}
      aria-current={l.active ? 'page' : undefined}
      className={`${navItemClass} ${l.active ? navItemActive : navItemIdle}`}
    >
      <Icon name={l.icon} />
      <span className="max-[519px]:sr-only">{l.label}</span>
    </Link>
  );
  return (
    <>
      {links.map(item)}
      {search}
      {item(team)}
    </>
  );
}
