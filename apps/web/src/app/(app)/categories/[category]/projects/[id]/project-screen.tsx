'use client';

import type { Job, Output } from '@oraqul/schema';
import { Button, buttonClassName, ChipButton, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import { ChartCard, StackedColumns } from '@/app/_workspace/charts';
import { ChatPanel, KindTag } from '@/app/_workspace/chat/chat-panel';
import { Crumbs } from '@/app/_workspace/crumbs';
import { formatDay, plural } from '@/app/_workspace/format';
import { NotInSession } from '@/app/_workspace/not-in-session';
import { toast } from '@/app/_workspace/toast';
import type { Viewer } from '@/lib/api/viewer';
import { createThread, deleteProject, setActor } from '@/lib/demo/actions';
import { getCategory } from '@/lib/demo/catalog';
import {
  comparePlans,
  getProjectDetail,
  getThreadDetail,
  type ProjectDetail,
  planOutputs,
  type ThreadSummary,
} from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { type CategoryScope, projectPath, projectsPath } from '@/lib/routes';
import { Modal } from '../../../../_components/modal';

/** The project's address opens its newest chat. */
export function ProjectScreen({
  id,
  scope,
  viewer,
}: {
  id: string;
  scope: CategoryScope;
  viewer: Viewer;
}) {
  const state = useDemo();
  const router = useRouter();
  const project = state.projects.find((p) => p.id === id);
  const misplaced = project !== undefined && project.category !== scope;

  // A project has one address, under its own category. `all` and a wrong category both move there.
  useEffect(() => {
    if (project && misplaced) router.replace(projectPath(project));
  }, [project, misplaced, router]);

  if (!project) return <NotInSession what="project" />;
  if (misplaced) return null;
  return <ProjectWorkspace projectId={id} threadId={undefined} viewer={viewer} />;
}

/**
 * The project is the workspace: its chat in the middle, its other chats beside it, and
 * the current plan on top. Everything else about the project sits behind Project details.
 */
export function ProjectWorkspace({
  projectId,
  threadId,
  viewer,
}: {
  projectId: string;
  /** The chat (thread) to show. The newest one when left out. */
  threadId: string | undefined;
  viewer: Viewer;
}) {
  const state = useDemo();
  const router = useRouter();
  const detail = useMemo(() => getProjectDetail(state, projectId), [state, projectId]);
  const selectedId = threadId ?? detail?.threads[0]?.thread.id;
  const chat = useMemo(
    () => (selectedId ? getThreadDetail(state, selectedId) : undefined),
    [state, selectedId],
  );
  const [details, setDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = viewer.role !== 'viewer';

  useEffect(() => setActor(viewer.name), [viewer.name]);

  if (!detail) return <NotInSession what="project" />;
  const { project, threads, outputs } = detail;
  const info = getCategory(project.category);
  const labels = new Map(outputs.map((o) => [o.id, o.label]));
  const current = outputs.find((o) => o.id === detail.currentPlanId);

  function newChat() {
    setActor(viewer.name);
    router.push(`/threads/${createThread(project.id)}`);
  }

  return (
    <div className="view-enter flex flex-col gap-5" data-cat={project.category}>
      <header className="flex flex-col gap-2.5">
        <Crumbs
          items={[
            { label: 'Projects', href: projectsPath() },
            { label: info.name, href: projectsPath(project.category) },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
              <Icon name={project.category} className="size-5" />
            </span>
            <div className="min-w-0">
              {/* `truncate` clips overflow, so the line must be tall enough for descenders (y, g, Q). */}
              <h1 className="truncate font-display text-[clamp(22px,2.4vw,28px)] font-semibold leading-[1.3] tracking-[-0.02em]">
                {project.name}
              </h1>
              <p className="truncate text-[13px] text-muted">
                {[info.name, project.kind, project.genre, project.window]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDetails(true)}>Project details</Button>
            {canEdit ? (
              <Button variant="primary" onClick={newChat}>
                <Icon name="plus" className="size-4" />
                New chat
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[232px_minmax(0,1fr)]">
        <aside aria-label="Chats" className="hidden flex-col gap-4 min-[900px]:flex">
          {current ? <CurrentPlan output={current} /> : null}
          <div className="flex flex-col gap-1.5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Chats
            </p>
            <ChatList threads={threads} selectedId={selectedId} />
          </div>
        </aside>
        {current ? (
          <div className="min-[900px]:hidden">
            <CurrentPlan output={current} />
          </div>
        ) : null}
        <details className="rounded-2xl bg-card px-4 py-3 min-[900px]:hidden">
          <summary className="cursor-pointer text-sm font-semibold">
            Chats ({threads.length})
          </summary>
          <div className="mt-3">
            <ChatList threads={threads} selectedId={selectedId} />
          </div>
        </details>
        {chat ? (
          <section
            aria-label={`Chat: ${chat.thread.name}`}
            className="flex h-[calc(100dvh-180px)] min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl bg-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3.5">
              <h2 className="font-display truncate text-[15px] font-semibold">
                {chat.thread.name}
              </h2>
              <p className="text-[12.5px] text-muted">{builtOnText(chat.thread, labels)}</p>
            </div>
            <ChatPanel key={chat.thread.id} detail={chat} canEdit={canEdit} />
          </section>
        ) : (
          <p className="rounded-2xl bg-card p-7 text-center text-muted">
            No chats yet.{canEdit ? ' Start one with New chat.' : ''}
          </p>
        )}
      </div>

      <Modal open={details} onClose={() => setDetails(false)} title="Project details" wide>
        <Details
          detail={detail}
          canDelete={viewer.role === 'owner'}
          onDelete={() => {
            setDetails(false);
            setDeleting(true);
          }}
        />
      </Modal>
      <Modal open={deleting} onClose={() => setDeleting(false)} title={`Delete ${project.name}?`}>
        <p className="text-muted">
          This removes the project, its {plural(threads.length, 'chat')} and{' '}
          {plural(outputs.length, 'output')} for everyone on the team. It cannot be undone.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
          <Button
            variant="dangerSolid"
            onClick={() => {
              deleteProject(project.id);
              toast(`${project.name} deleted`);
              router.push(projectsPath(project.category));
            }}
          >
            Delete project
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function builtOnText(
  thread: { fromOutputId: string | null; fresh: boolean },
  labels: Map<string, string>,
): string {
  const from = thread.fromOutputId ? labels.get(thread.fromOutputId) : undefined;
  if (from) return `Built on ${from}`;
  return thread.fresh ? 'Started fresh, no earlier plan used' : 'Started from the project inputs';
}

/** The plan every new chat builds on, kept beside the chat as one small card. */
function CurrentPlan({ output }: { output: Output }) {
  return (
    <section aria-label="Current plan" className="flex flex-col gap-1.5 rounded-xl bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Icon name="flag" className="size-3.5 text-accent" />
        Current plan
      </p>
      <Link
        href={`/outputs/${output.id}`}
        className="flex flex-col gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <KindTag kind={output.kind} label={output.kindLabel} />
          <span className="truncate hover:underline">{output.label}</span>
        </span>
        <span className="line-clamp-3 text-[12.5px] leading-[1.45] text-muted">
          {output.headline}
        </span>
      </Link>
    </section>
  );
}

function ChatList({
  threads,
  selectedId,
}: {
  threads: ThreadSummary[];
  selectedId: string | undefined;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {threads.map(({ thread, outputCount, unread }) => {
        const selected = thread.id === selectedId;
        return (
          <li key={thread.id}>
            <Link
              href={`/threads/${thread.id}`}
              aria-current={selected ? 'page' : undefined}
              className={`flex flex-col rounded-xl px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${selected ? 'bg-card font-semibold' : 'hover:bg-surface2'}`}
            >
              <span className="flex items-center gap-1.5 text-sm">
                <span className="truncate">{thread.name}</span>
                {unread && !selected ? (
                  <span className="shrink-0 rounded bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
                    New
                  </span>
                ) : null}
              </span>
              <span className="text-[12.5px] font-normal text-muted">
                {plural(outputCount, 'output')} · {thread.createdBy}, {formatDay(thread.createdAt)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Details({
  detail,
  canDelete,
  onDelete,
}: {
  detail: ProjectDetail;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { project, outputs, threads } = detail;
  const info = getCategory(project.category);
  const plans = planOutputs(outputs);
  const value = (v: string) => v || 'Not given';
  const inputs: [string, string][] = [
    [info.inputLabels.kind, value(project.kind)],
    [info.inputLabels.genre, value(project.genre)],
    [info.inputLabels.lead, value(project.lead)],
    [info.inputLabels.comps, value(project.comps.join(', '))],
    [info.inputLabels.places, value(project.places.join(', '))],
    [info.inputLabels.window, value(project.window)],
    [info.extraLabel, project.extra[info.extraLabel] ?? 'Not given'],
    ['Qloo match', project.qlooMatch ?? `Matched by ${info.fallback}`],
  ];
  return (
    <div className="flex flex-col gap-[18px]">
      <section className="rounded-2xl bg-card px-5 py-[18px]">
        <h3 className="font-display text-[15px] font-semibold">Inputs used</h3>
        <p className="mb-3 text-[13px] text-muted">
          What every chat starts from. To change anything, tell the agent in the chat.
        </p>
        <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px] min-[900px]:grid-cols-[150px_minmax(0,1fr)]">
          {inputs.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      {plans.length ? (
        <ChartCard
          title="How the plan moved"
          note="Verdicts for each plan, audit, scenario and rescue."
          table={{
            head: ['Output', 'Holds', 'Weak', 'Breaks', 'Could not test'],
            rows: plans.map((o) => [
              o.label,
              o.counts.holds,
              o.counts.weak,
              o.counts.breaks,
              o.counts.cant,
            ]),
          }}
        >
          <StackedColumns columns={plans.map((o) => ({ label: o.shortLabel, counts: o.counts }))} />
        </ChartCard>
      ) : null}
      <Lineage plans={plans} />
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-[15px] font-semibold">All outputs</h3>
        <OutputsList outputs={outputs} currentPlanId={detail.currentPlanId} threads={threads} />
      </section>
      {canDelete ? (
        <div className="max-[899px]:hidden">
          <Button variant="danger" onClick={onDelete}>
            <Icon name="trash" className="size-4" />
            Delete project
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function OutputsList({
  outputs,
  currentPlanId,
  threads,
}: {
  outputs: Output[];
  currentPlanId: string | null;
  threads: ThreadSummary[];
}) {
  const [kind, setKind] = useState<Job | 'all'>('all');
  const kinds = (['plan', 'audit', 'scenario', 'rescue', 'date', 'partner'] as const).filter((k) =>
    outputs.some((o) => o.kind === k),
  );
  const names = new Map(threads.map(({ thread }) => [thread.id, thread.name]));
  const list = outputs
    .slice()
    .reverse()
    .filter((o) => kind === 'all' || o.kind === kind);
  if (!outputs.length) {
    return <p className="rounded-xl bg-card p-7 text-center text-muted">No outputs yet.</p>;
  }
  return (
    <>
      {kinds.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <ChipButton selected={kind === 'all'} onClick={() => setKind('all')}>
            All
          </ChipButton>
          {kinds.map((k) => (
            <ChipButton key={k} selected={kind === k} onClick={() => setKind(k)}>
              {outputs.find((o) => o.kind === k)?.kindLabel}
            </ChipButton>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {list.map((o) => (
          <div
            key={o.id}
            className="grid grid-cols-1 items-start gap-2.5 rounded-xl bg-card px-4 py-3 min-[900px]:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="min-w-0">
              <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <KindTag kind={o.kind} label={o.kindLabel} /> {o.label}
                {o.id === currentPlanId ? (
                  <span className="rounded bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
                    Current plan
                  </span>
                ) : null}
              </h4>
              <p className="text-[13px] text-muted">
                {o.headline.length > 150 ? `${o.headline.slice(0, 148)}…` : o.headline}
              </p>
              <p className="text-[13px] text-muted">
                In {names.get(o.threadId)} · {o.createdBy}, {formatDay(o.createdAt)}
              </p>
            </div>
            <Link href={`/outputs/${o.id}`} className={buttonClassName('default', 'small')}>
              Open
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}

function Lineage({ plans }: { plans: Output[] }) {
  const [comparing, setComparing] = useState(false);
  const byId = new Map(plans.map((o) => [o.id, o]));
  return (
    <section className="rounded-2xl bg-card px-5 py-[18px]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <h3 className="font-display text-[15px] font-semibold">Plan lineage</h3>
          <p className="text-[13px] text-muted">
            Each plan and the one it was built on. You can also ask the agent to compare plans.
          </p>
        </div>
        {plans.length > 1 ? (
          <Button size="small" aria-expanded={comparing} onClick={() => setComparing((c) => !c)}>
            {comparing ? 'Hide comparison' : 'Compare two plans'}
          </Button>
        ) : null}
      </div>
      {comparing ? <Compare plans={plans} /> : null}
      <div className="flex flex-col gap-3">
        {plans.length ? (
          plans.map((o) => (
            <div
              key={o.id}
              className={`flex flex-wrap items-start justify-between gap-2.5 rounded-xl bg-inset px-4 py-3 ${o.parentId ? 'ml-[18px]' : ''}`}
            >
              <div>
                <h4 className="text-sm font-semibold">{o.label}</h4>
                <p className="text-[13px] text-muted">
                  {o.parentId
                    ? `Built on ${byId.get(o.parentId)?.label ?? 'an earlier plan'}`
                    : 'Starting plan'}
                </p>
              </div>
              <Link href={`/outputs/${o.id}`} className={buttonClassName('default', 'small')}>
                Open
              </Link>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-inset p-7 text-center text-muted">No plan yet.</p>
        )}
      </div>
    </section>
  );
}

function Compare({ plans }: { plans: Output[] }) {
  const [a, setA] = useState(plans.at(-2)?.id ?? '');
  const [b, setB] = useState(plans.at(-1)?.id ?? '');
  const result = useMemo(() => (a && b ? comparePlans(a, b) : undefined), [a, b]);
  const planOptions = plans.map((o) => ({ value: o.id, label: o.label }));
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl bg-inset p-4">
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        <Dropdown id="compare-a" label="From" value={a} options={planOptions} onChange={setA} />
        <Dropdown id="compare-b" label="To" value={b} options={planOptions} onChange={setB} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {plural(result?.changes.length ?? 0, 'line')} differ
      </p>
      {result?.changes.length ? (
        result.changes.map((c) => (
          <div key={c.lineId}>
            <h4 className="mb-1.5 text-sm font-semibold">{c.label}</h4>
            <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
              <div className="rounded-lg bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Before
                </p>
                {c.before ?? 'Not in this plan'}
              </div>
              <div className="rounded-lg border border-accent/40 bg-accent-soft p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  After
                </p>
                {c.after ?? 'Removed'}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted">These two plans are identical.</p>
      )}
    </div>
  );
}
