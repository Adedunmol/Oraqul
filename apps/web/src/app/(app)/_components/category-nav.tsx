'use client';

import { type Category, categories } from '@oraqul/schema';
import { Icon, type IconName } from '@oraqul/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCategory } from '@/lib/demo/catalog';
import type { DemoState } from '@/lib/demo/store';
import { useDemo } from '@/lib/demo/use-demo';
import { type CategoryScope, overviewPath, parseScope, projectsPath } from '@/lib/routes';
import { navCountClass, navItemActive, navItemClass, navItemIdle } from './nav-link';

/** The category the current page belongs to, so its nav item stays lit inside a project. */
function currentCategory(pathname: string, s: DemoState): CategoryScope | null {
  const [, section, id] = pathname.split('/');
  if (section === 'categories') {
    const scope = id === undefined ? undefined : parseScope(id);
    return scope ?? null;
  }
  let projectId: string | undefined;
  if (section === 'threads') projectId = s.threads.find((t) => t.id === id)?.projectId;
  if (section === 'outputs') projectId = s.outputs.find((o) => o.id === id)?.projectId;
  return s.projects.find((p) => p.id === projectId)?.category ?? null;
}

const groupLabel =
  'px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted rail:sr-only';

function Item({
  href,
  icon,
  label,
  count,
  active,
  category,
}: {
  href: string;
  icon: IconName;
  label: string;
  /** Projects in this item. Left out for items that are not a list of projects. */
  count?: number;
  active: boolean;
  category?: Category;
}) {
  return (
    <Link
      href={href}
      data-cat={category}
      aria-current={active ? 'page' : undefined}
      data-rail-tip={label}
      className={`${navItemClass} ${active ? navItemActive : navItemIdle}`}
    >
      <Icon name={icon} className={category ? 'text-cat' : undefined} />
      <span className="rail:sr-only">{label}</span>
      {count === undefined ? null : (
        <span className={navCountClass}>
          {count}
          <span className="sr-only"> projects</span>
        </span>
      )}
    </Link>
  );
}

export function CategoryNav() {
  const s = useDemo();
  const pathname = usePathname();
  const current = currentCategory(pathname, s);
  return (
    <>
      <div className="flex flex-col gap-1">
        <Item
          href={overviewPath}
          icon="overview"
          label="Overview"
          active={pathname === overviewPath}
        />
        <Item
          href={projectsPath()}
          icon="projects"
          label="All projects"
          count={s.projects.length}
          active={current === 'all'}
        />
      </div>
      <div className="flex flex-col gap-1 rail:pt-3">
        <p className={groupLabel}>Categories</p>
        {categories.map((c) => (
          <Item
            key={c}
            href={projectsPath(c)}
            icon={c}
            category={c}
            label={getCategory(c).name}
            count={s.projects.filter((p) => p.category === c).length}
            active={current === c}
          />
        ))}
      </div>
    </>
  );
}

/** Below 900px the sidebar becomes a top bar with a category select. design-system §6 */
export function CategorySelect() {
  const s = useDemo();
  const pathname = usePathname();
  const router = useRouter();
  const current = currentCategory(pathname, s);
  return (
    <>
      <label htmlFor="mobile-category" className="sr-only">
        Go to
      </label>
      <select
        id="mobile-category"
        value={current ?? ''}
        onChange={(e) => {
          const scope = parseScope(e.target.value);
          router.push(scope ? projectsPath(scope) : overviewPath);
        }}
        className="max-w-[55%] rounded-[10px] bg-surface px-3 py-2 text-sm"
      >
        <option value="">Overview</option>
        <option value="all">All projects</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {getCategory(c).name}
          </option>
        ))}
      </select>
    </>
  );
}
