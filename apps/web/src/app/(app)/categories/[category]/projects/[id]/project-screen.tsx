'use client';

import {
  type Category,
  type CompareResponse,
  type Job,
  type Output,
  type ProjectDetail,
  planKinds,
  type ThreadDetail,
  type ThreadEvent,
  type ThreadSummary,
} from '@oraqul/schema';
import { Button, buttonClassName, ChipButton, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Dropdown } from '@/app/_components/dropdown';
import { ChartCard, StackedColumns } from '@/app/_workspace/charts';
import { KindTag } from '@/app/_workspace/chat/chat-panel';
import { LiveChat } from '@/app/_workspace/chat/live-chat';
import { Crumbs } from '@/app/_workspace/crumbs';
import { formatDay, plural } from '@/app/_workspace/format';
import { toast } from '@/app/_workspace/toast';
import { comparePlans, createThread, deleteProject } from '@/lib/api/projects';
import type { Viewer } from '@/lib/api/viewer';
import { getCategory } from '@/lib/demo/catalog';
import { projectsPath } from '@/lib/routes';
import { ConfirmDialog } from '../../../../_components/confirm-dialog';
import { Modal } from '../../../../_components/modal';

type ProjectUpdate = Extract<ThreadEvent, { type: 'project.updated' }>;

const isPlan = (o: Output): boolean => (planKinds as readonly string[]).includes(o.kind);

const bar = 'rounded-md bg-surface2 motion-safe:animate-pulse';

/**
 * The project workspace. While the router is still reading the first message, the name, category
 * and chat name show as skeletons.
 */
export function ProjectWorkspace({
  detail,
  chat,
  viewer,
}: {
  detail: ProjectDetail;
  /** The chat to show: the one in the address, or the newest. Null when there is none. */
  chat: ThreadDetail | null;
  viewer: Viewer;
}) {
  const router = useRouter();
  const [update, setUpdate] = useState<ProjectUpdate | null>(null);
  const [details, setDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = detail.myRole !== 'viewer';
  const onProjectUpdated = useCallback((event: ProjectUpdate) => setUpdate(event), []);

  const { project, threads, outputs } = detail;
  const name = update?.name ?? project.name;
  const category = update?.category ?? project.category;
  const reading = name === null || category === null;
  const info = category ? getCategory(category) : undefined;
  const labels = new Map(outputs.map((o) => [o.id, o.label]));
  const current = outputs.find((o) => o.id === detail.currentPlanId);
  const selectedId = chat?.thread.id;
  const chatName = (id: string, stored: string) =>
    update && id === selectedId ? update.threadName : stored;

  async function newChat() {
    try {
      router.push(`/threads/${await createThread(project.id)}`);
    } catch {
      toast('Could not start a new chat. Try again.');
    }
  }

  return (
    <div className="view-enter flex flex-col gap-5" data-cat={category ?? undefined}>
      <header className="sticky-head flex flex-col gap-2.5">
        <Crumbs
          items={[
            { label: 'Projects', href: projectsPath() },
            ...(info ? [{ label: info.name, href: projectsPath(info.id) }] : []),
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            {category ? (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_15%,var(--surface))] text-cat">
                <Icon name={category} className="size-5" />
              </span>
            ) : (
              <span aria-hidden className={`size-10 shrink-0 rounded-xl ${bar}`} />
            )}
            <div className="min-w-0">
              {reading ? (
                <div
                  role="status"
                  aria-label="Reading what this project is"
                  className="flex flex-col gap-2 py-1"
                >
                  <span className={`block h-6 w-44 ${bar}`} />
                  <span className={`block h-3.5 w-28 ${bar}`} />
                </div>
              ) : (
                <>
                  {/* `truncate` clips overflow, so the line must be tall enough for descenders (y, g, Q). */}
                  <h1 className="truncate font-display text-[clamp(22px,2.4vw,28px)] font-semibold leading-[1.3] tracking-[-0.02em]">
                    {name}
                  </h1>
                  <p className="truncate text-[13px] text-muted">
                    {[info?.name, project.kind, project.genre, project.window]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="details" onClick={() => setDetails(true)} disabled={reading}>
              Project details
            </Button>
            {canEdit ? (
              <Button variant="primary" icon="plus" onClick={newChat} disabled={reading}>
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
            <p className="px-3 text-[12px] font-semibold text-muted">Chats</p>
            <ChatList
              threads={threads}
              selectedId={selectedId}
              nameOf={chatName}
              reading={reading}
            />
          </div>
        </aside>
        <details className="rounded-2xl bg-card px-4 py-3 min-[900px]:hidden">
          <summary className="cursor-pointer text-sm font-semibold">
            Chats ({threads.length})
          </summary>
          <div className="mt-3">
            <ChatList
              threads={threads}
              selectedId={selectedId}
              nameOf={chatName}
              reading={reading}
            />
          </div>
        </details>
        {chat ? (
          <section
            aria-label={`Chat: ${chatName(chat.thread.id, chat.thread.name)}`}
            className="flex h-[calc(100dvh-24px)] min-h-[480px] min-w-0 min-[900px]:h-[calc(100dvh-180px)] min-[900px]:min-h-[520px] flex-col overflow-hidden rounded-2xl bg-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3.5">
              {reading ? (
                <span aria-hidden className={`block h-4 w-24 ${bar}`} />
              ) : (
                <h2 className="font-display truncate text-[15px] font-semibold">
                  {chatName(chat.thread.id, chat.thread.name)}
                </h2>
              )}
              <p className="text-[12.5px] text-muted">{builtOnText(chat.thread, labels)}</p>
            </div>
            <LiveChat
              key={chat.thread.id}
              detail={chat}
              canEdit={canEdit}
              onProjectUpdated={onProjectUpdated}
            />
          </section>
        ) : (
          <p className="rounded-2xl bg-card p-7 text-center text-muted">
            No chats yet.{canEdit ? ' Start one with New chat.' : ''}
          </p>
        )}
      </div>

      {info && name ? (
        <>
          <Modal open={details} onClose={() => setDetails(false)} title="Project details" wide>
            <Details
              detail={detail}
              category={info.id}
              canDelete={viewer.role === 'owner' && detail.myRole === 'owner'}
              onDelete={() => {
                setDetails(false);
                setDeleting(true);
              }}
            />
          </Modal>
          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            title={`Delete ${name}?`}
            confirmLabel="Delete project"
            onConfirm={async () => {
              try {
                await deleteProject(project.id);
                toast(`${name} deleted`);
                router.push(projectsPath(info.id));
                router.refresh();
              } catch {
                toast(`Could not delete ${name}. Try again.`);
              }
            }}
          >
            <p>
              This removes the project, its {plural(threads.length, 'chat')} and{' '}
              {plural(outputs.length, 'output')} for everyone on the team.
            </p>
            <p className="font-medium text-ink">It cannot be undone.</p>
          </ConfirmDialog>
        </>
      ) : null}
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

function CurrentPlan({ output }: { output: Output }) {
  return (
    <section aria-label="Current plan" className="flex flex-col gap-1.5 rounded-xl bg-card p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
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
  nameOf,
  reading,
}: {
  threads: ThreadSummary[];
  selectedId: string | undefined;
  /** The chat's name, including one the router has just set. */
  nameOf: (id: string, stored: string) => string;
  /** The router is still reading the project, so the first chat has no name yet. */
  reading: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {threads.map(({ thread, outputCount, unread }) => {
        const selected = thread.id === selectedId;
        const name = nameOf(thread.id, thread.name);
        return (
          <li key={thread.id}>
            <Link
              href={`/threads/${thread.id}`}
              aria-current={selected ? 'page' : undefined}
              className={`flex flex-col rounded-xl px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${selected ? 'bg-card font-semibold' : 'hover:bg-surface2'}`}
            >
              <span className="flex items-center gap-1.5 text-sm">
                {reading ? (
                  <span
                    role="img"
                    aria-label="Naming this chat"
                    className={`block h-4 w-20 ${bar}`}
                  />
                ) : (
                  <span className="truncate">{name}</span>
                )}
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
  category,
  canDelete,
  onDelete,
}: {
  detail: ProjectDetail;
  category: Category;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { project, outputs, threads } = detail;
  const info = getCategory(category);
  const plans = outputs.filter(isPlan);
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
          note="Verdicts for each plan, scenario and fix."
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
          <Button variant="danger" icon="trash" onClick={onDelete}>
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
  const kinds = (['build', 'audit', 'scenario', 'fix', 'date', 'partner'] as const).filter((k) =>
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
  const [pair, setPair] = useState<{ a: string; b: string }>({
    a: plans.at(-2)?.id ?? '',
    b: plans.at(-1)?.id ?? '',
  });
  const [result, setResult] = useState<CompareResponse | 'loading' | 'failed'>('loading');
  // Read when the person opens the comparison or picks a plan, never from an effect.
  const load = (next: { a: string; b: string }) => {
    setPair(next);
    const projectId = plans[0]?.projectId;
    if (!projectId || !next.a || !next.b) return;
    setResult('loading');
    comparePlans(projectId, next.a, next.b).then(setResult, () => setResult('failed'));
  };
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
          <Button
            size="small"
            aria-expanded={comparing}
            onClick={() => {
              if (!comparing) load(pair);
              setComparing((c) => !c);
            }}
          >
            {comparing ? 'Hide comparison' : 'Compare two plans'}
          </Button>
        ) : null}
      </div>
      {comparing ? <Compare plans={plans} pair={pair} result={result} onPick={load} /> : null}
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

function Compare({
  plans,
  pair,
  result,
  onPick,
}: {
  plans: Output[];
  pair: { a: string; b: string };
  result: CompareResponse | 'loading' | 'failed';
  onPick: (pair: { a: string; b: string }) => void;
}) {
  const { a, b } = pair;
  const planOptions = plans.map((o) => ({ value: o.id, label: o.label }));
  if (result === 'failed') {
    return (
      <div className="mb-4 rounded-xl bg-inset p-4 text-muted">
        The comparison did not load.{' '}
        <Button size="small" variant="ghost" onClick={() => onPick(pair)}>
          Try again
        </Button>
      </div>
    );
  }
  const changes = result === 'loading' ? null : result.changes;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl bg-inset p-4">
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        <Dropdown
          id="compare-a"
          label="From"
          value={a}
          options={planOptions}
          onChange={(next) => onPick({ a: next, b })}
        />
        <Dropdown
          id="compare-b"
          label="To"
          value={b}
          options={planOptions}
          onChange={(next) => onPick({ a, b: next })}
        />
      </div>
      <p className="text-[12px] font-semibold text-muted">
        {changes === null ? 'Comparing…' : `${plural(changes.length, 'line')} differ`}
      </p>
      {changes === null ? null : changes.length ? (
        changes.map((c) => (
          <div key={c.lineId}>
            <h4 className="mb-1.5 text-sm font-semibold">{c.label}</h4>
            <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
              <div className="rounded-lg bg-card p-3">
                <p className="text-[12px] font-semibold text-muted">Before</p>
                {c.before ?? 'Not in this plan'}
              </div>
              <div className="rounded-lg border border-accent/40 bg-accent-soft p-3">
                <p className="text-[12px] font-semibold text-muted">After</p>
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
