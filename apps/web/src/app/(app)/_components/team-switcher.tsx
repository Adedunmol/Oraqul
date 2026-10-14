'use client';

import type { Role, TeamSummary } from '@oraqul/schema';
import { Icon } from '@oraqul/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { setCurrentTeam } from '@/lib/current-team';
import { roleLabels } from '@/lib/roles';
import { CreateTeamForm } from './create-team-form';
import { Modal } from './modal';

export function TeamSwitcher({
  teams,
  current,
}: {
  teams: TeamSummary[];
  current?: { id: string; name: string; role: Role; memberCount: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  function choose(id: string) {
    setCurrentTeam(id);
    setOpen(false);
    router.refresh();
  }

  const item =
    'flex min-h-10 w-full items-center rounded-[10px] px-3 py-2 text-left text-sm transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-rail-tip={current?.name ?? 'No team yet'}
        className="flex w-full items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none rail:justify-center rail:rounded-[10px] rail:p-1.5"
      >
        <span
          aria-hidden
          className="hidden size-8 place-items-center rounded-lg bg-surface2 text-sm font-semibold rail:grid"
        >
          {(current?.name ?? '?').charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 rail:sr-only">
          <span className="truncate text-sm font-semibold">{current?.name ?? 'No team yet'}</span>
          {current ? (
            <span className="text-[13px] text-muted">
              {roleLabels[current.role]} · {current.memberCount}{' '}
              {current.memberCount === 1 ? 'member' : 'members'}
            </span>
          ) : null}
        </span>
        <Icon name="chevron" className="text-muted rail:hidden" />
      </button>

      {open ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 rail:right-auto rail:w-56 flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow)]">
          {teams.map((team) => (
            <li key={team.id}>
              <button
                type="button"
                aria-current={team.id === current?.id ? 'true' : undefined}
                onClick={() => choose(team.id)}
                className={`${item} ${team.id === current?.id ? 'bg-accent-soft font-semibold' : ''}`}
              >
                <span className="truncate">{team.name}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className={item}
            >
              + Create a team
            </button>
          </li>
        </ul>
      ) : null}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create a team">
        <CreateTeamForm onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
