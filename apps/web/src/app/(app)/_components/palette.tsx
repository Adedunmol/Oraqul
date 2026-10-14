'use client';

import { categories } from '@oraqul/schema';
import { Icon, type IconName, Kbd } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getCategory } from '@/lib/demo/catalog';
import { useDemo } from '@/lib/demo/use-demo';
import { overviewPath, projectPath, projectsPath, startPath } from '@/lib/routes';

interface Entry {
  group: 'Go to' | 'Categories' | 'Projects' | 'Outputs' | 'Actions';
  label: string;
  hint?: string;
  icon?: IconName;
  href: string;
}

let openPalette: (() => void) | undefined;

/** The sidebar's search button. Ctrl K or Cmd K opens the same palette. */
export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => openPalette?.()}
      data-rail-tip="Search (⌘K)"
      className="flex w-full items-center gap-2.5 rounded-lg bg-surface2 px-2.5 py-2 text-left text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-[899px]:w-auto rail:min-h-10 rail:justify-center rail:px-0"
    >
      <Icon name="search" />
      <span className="flex-1 max-[899px]:sr-only rail:sr-only">Search</span>
      <span className="max-[899px]:hidden rail:hidden">
        <Kbd>⌘K</Kbd>
      </span>
    </button>
  );
}

/**
 * Client side search over the team's categories, projects, outputs and fixed actions, grouped
 * by type. design-system §7.18 and spec §9.3
 */
export function Palette() {
  const s = useDemo();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = useId();

  useEffect(() => {
    openPalette = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      openPalette = undefined;
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setQuery('');
      setActive(0);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const projectName = new Map(s.projects.map((p) => [p.id, p]));
    return [
      { group: 'Go to', label: 'Overview', icon: 'overview', href: overviewPath },
      { group: 'Go to', label: 'Projects', icon: 'projects', href: projectsPath() },
      ...categories.map((c): Entry => {
        const n = s.projects.filter((p) => p.category === c).length;
        return {
          group: 'Categories',
          label: getCategory(c).name,
          hint: `${n} ${n === 1 ? 'project' : 'projects'}`,
          icon: c,
          href: projectsPath(c),
        };
      }),
      ...s.projects.map(
        (p): Entry => ({
          group: 'Projects',
          label: p.name,
          hint: getCategory(p.category).name,
          icon: p.category,
          href: projectPath(p),
        }),
      ),
      ...s.outputs.map((o): Entry => {
        const p = projectName.get(o.projectId);
        return {
          group: 'Outputs',
          label: o.label,
          hint: `${p?.name ?? ''} · ${o.kindLabel}`,
          icon: p?.category,
          href: `/outputs/${o.id}`,
        };
      }),
      { group: 'Actions', label: 'New project', icon: 'plus', href: startPath() },
      { group: 'Actions', label: 'Team and roles', icon: 'team', href: '/team' },
    ];
  }, [s.projects, s.outputs]);

  const q = query.trim().toLowerCase();
  const results = entries
    .filter((e) => !q || `${e.label} ${e.hint ?? ''} ${e.group}`.toLowerCase().includes(q))
    .slice(0, 12);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a mouse shortcut; Esc is the keyboard way out
    <dialog
      ref={dialog}
      aria-label="Search"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === dialog.current) setOpen(false);
      }}
      className="pop-in mx-auto mt-[12vh] flex max-h-[70vh] w-[min(calc(100%-32px),600px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow)] [&:not([open])]:hidden"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5 text-muted">
        <Icon name="search" />
        <input
          autoFocus
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(results[active]);
            }
          }}
          placeholder="Search projects, outputs and actions"
          aria-label="Search projects, outputs and actions"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none"
        />
        <Kbd>esc</Kbd>
      </div>
      <div id={listId} role="listbox" className="overflow-y-auto p-1.5">
        {results.length ? (
          results.map((e, i) => (
            <div key={e.href + e.label}>
              {i === 0 || results[i - 1]?.group !== e.group ? (
                <p className="px-2.5 pt-2.5 pb-1 text-[12px] font-semibold text-muted">
                  {e.group}
                </p>
              ) : null}
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                data-cat={
                  e.icon && e.group !== 'Go to' && e.group !== 'Actions' ? e.icon : undefined
                }
                onMouseEnter={() => setActive(i)}
                onClick={() => go(e)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ${i === active ? 'bg-surface2' : ''}`}
              >
                {e.icon ? (
                  <Icon name={e.icon} className="text-muted" />
                ) : (
                  <span className="size-[18px]" />
                )}
                <span className="min-w-0 flex-1 truncate">{e.label}</span>
                {e.hint ? (
                  <span className="whitespace-nowrap text-xs text-muted">{e.hint}</span>
                ) : null}
              </button>
            </div>
          ))
        ) : (
          <p className="px-2.5 py-2.5 text-[12px] font-semibold text-muted">
            Nothing matches
          </p>
        )}
      </div>
      <div className="flex gap-4 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> move
        </span>
        <span>
          <Kbd>↵</Kbd> open
        </span>
      </div>
    </dialog>
  );
}
