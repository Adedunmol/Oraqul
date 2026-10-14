'use client';

import type { Job, Output } from '@oraqul/schema';
import { Button, buttonClassName, ChipButton, Select, Tabs } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChartCard, StackedColumns } from '@/app/_workspace/charts';
import { KindTag } from '@/app/_workspace/chat/chat-panel';
import { Crumbs } from '@/app/_workspace/crumbs';
import { DemoNote } from '@/app/_workspace/demo-note';
import { formatDay, plural } from '@/app/_workspace/format';
import { NotInSession } from '@/app/_workspace/not-in-session';
import { toast } from '@/app/_workspace/toast';
import type { Viewer } from '@/lib/api/viewer';
import { createThread, deleteProject, setActor } from '@/lib/demo/actions';
import { getCategory } from '@/lib/demo/catalog';
import { comparePlans, getProjectDetail, planOutputs } from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { type CategoryScope, projectPath, projectsPath } from '@/lib/routes';
import { Modal } from '../../../../_components/modal';

type Tab = 'threads' | 'outputs' | 'about';

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
  const detail = useMemo(() => getProjectDetail(state, id), [state, id]);
  const [tab, setTab] = useState<Tab>('threads');
  const [deleting, setDeleting] = useState(false);
  const misplaced = detail !== undefined && detail.project.category !== scope;

  // A project has one address, under its own category. `all` and a wrong category both move there.
  useEffect(() => {
    if (detail && misplaced) router.replace(projectPath(detail.project));
  }, [detail, misplaced, router]);

  if (!detail) return <NotInSession what="project" />;
  if (misplaced) return null;

  const { project, threads, outputs } = detail;
  const info = getCategory(project.category);
  const canEdit = viewer.role !== 'viewer';
  const labels = new Map(outputs.map((o) => [o.id, o.label]));

  function newThread() {
    setActor(viewer.name);
    router.push(`/threads/${createThread(project.id)}`);
  }

  return (
    <div className="view-enter flex flex-col gap-7" data-cat={project.category}>
      <DemoNote />
      <Crumbs
        items={[
          { label: info.name, href: projectsPath(project.category) },
          { label: project.name },
        ]}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span className="rounded-[7px] bg-accent-soft px-2.5 py-px text-ink">{info.name}</span>
            {[project.kind, project.genre, project.window].filter(Boolean).join(' · ')}
          </p>
          <h1 className="font-display text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
            {project.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button variant="primary" onClick={newThread}>
              Ask something new or different
            </Button>
          ) : null}
          {viewer.role === 'owner' ? (
            <Button className="max-[899px]:hidden" onClick={() => setDeleting(true)}>
              Delete project
            </Button>
          ) : null}
        </div>
      </header>
      <Tabs
        label="Project sections"
        selected={tab}
        onSelect={setTab}
        items={[
          { key: 'threads', label: 'Threads', count: threads.length },
          { key: 'outputs', label: 'Outputs', count: outputs.length },
          { key: 'about', label: 'About this project' },
        ]}
      />
      <div key={tab} className="tab-enter flex flex-col gap-[18px]">
        {tab === 'threads' ? (
          threads.length ? (
            <div className="flex flex-col gap-3">
              {threads.map(({ thread, outputCount, unread }) => (
                <Link
                  key={thread.id}
                  href={`/threads/${thread.id}`}
                  className="grid grid-cols-1 items-center gap-3.5 rounded-2xl bg-card px-[18px] py-3.5 transition-colors hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-[900px]:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">
                      {thread.name}
                      {unread ? (
                        <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-px align-middle text-[11px] font-semibold text-accent">
                          New
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-muted">{builtOnText(thread, labels)}</p>
                  </div>
                  <p className="text-[13px] text-muted min-[900px]:text-right">
                    {plural(outputCount, 'output')}
                    <br />
                    {thread.createdBy}, {formatDay(thread.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-card p-7 text-center text-muted">No threads yet.</p>
          )
        ) : null}
        {tab === 'outputs' ? (
          <OutputsList outputs={outputs} currentPlanId={detail.currentPlanId} threads={threads} />
        ) : null}
        {tab === 'about' ? <About detail={detail} /> : null}
      </div>
      <Modal open={deleting} onClose={() => setDeleting(false)} title={`Delete ${project.name}?`}>
        <p className="text-muted">
          This removes the project, its {plural(threads.length, 'thread')} and{' '}
          {plural(outputs.length, 'output')} for everyone on the team. It cannot be undone.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
          <Button
            className="border-breaks! bg-breaks! text-surface!"
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

function OutputsList({
  outputs,
  currentPlanId,
  threads,
}: {
  outputs: Output[];
  currentPlanId: string | null;
  threads: { thread: { id: string; name: string } }[];
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
  return (
    <>
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
                From thread: {names.get(o.threadId)} · {o.createdBy}, {formatDay(o.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/outputs/${o.id}`} className={buttonClassName('default', 'small')}>
                Open
              </Link>
              <Link
                href={`/outputs/${o.id}?tab=evidence`}
                className={buttonClassName('ghost', 'small')}
              >
                Evidence
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function About({ detail }: { detail: NonNullable<ReturnType<typeof getProjectDetail>> }) {
  const { project, outputs } = detail;
  const info = getCategory(project.category);
  const plans = planOutputs(outputs);
  const [comparing, setComparing] = useState(false);
  const value = (v: string) => v || 'Not given';
  const inputs: [string, string][] = [
    [info.inputLabels.kind, value(project.kind)],
    [info.inputLabels.genre, value(project.genre)],
    [info.inputLabels.lead, value(project.lead)],
    [info.inputLabels.comps, value(project.comps.join(', '))],
    [info.inputLabels.places, value(project.places.join(', '))],
    [info.inputLabels.window, value(project.window)],
    [info.extraLabel, project.extra[info.extraLabel] ?? 'Not asked'],
    ['Qloo match', project.qlooMatch ?? `Matched by ${info.fallback}`],
  ];
  const byId = new Map(outputs.map((o) => [o.id, o]));
  return (
    <>
      <section className="rounded-2xl bg-card px-5 py-[18px]">
        <h3 className="text-[15px] font-semibold">Inputs used</h3>
        <p className="mb-3 text-[13px] text-muted">
          What every thread starts from. To change anything, tell the agent in a thread.
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
      <section className="rounded-2xl bg-card px-5 py-[18px]">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-[15px] font-semibold">Plan lineage</h3>
            <p className="text-[13px] text-muted">Each plan output and the one it was built on.</p>
          </div>
          {plans.length > 1 ? (
            <Button size="small" onClick={() => setComparing(true)}>
              Compare two plans
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          {plans.length ? (
            plans.map((o) => (
              <div
                key={o.id}
                className={`flex flex-wrap items-start justify-between gap-2.5 rounded-xl bg-surface px-4 py-3 ${o.parentId ? 'ml-[18px]' : ''}`}
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
            <p className="rounded-xl bg-card p-7 text-center text-muted">No plan yet.</p>
          )}
        </div>
      </section>
      {plans.length > 1 ? (
        <CompareModal open={comparing} onClose={() => setComparing(false)} plans={plans} />
      ) : null}
    </>
  );
}

function CompareModal({
  open,
  onClose,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  plans: Output[];
}) {
  const [a, setA] = useState(plans.at(-2)?.id ?? '');
  const [b, setB] = useState(plans.at(-1)?.id ?? '');
  const result = useMemo(() => (a && b ? comparePlans(a, b) : undefined), [a, b]);
  return (
    <Modal open={open} onClose={onClose} title="Compare two plans" wide>
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        <Select id="compare-a" label="From" value={a} onChange={(e) => setA(e.target.value)}>
          {plans.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select id="compare-b" label="To" value={b} onChange={(e) => setB(e.target.value)}>
          {plans.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {plural(result?.changes.length ?? 0, 'line')} differ
      </p>
      <div className="flex flex-col gap-3">
        {result?.changes.length ? (
          result.changes.map((c) => (
            <div key={c.lineId}>
              <h4 className="mb-1.5 text-sm font-semibold">{c.label}</h4>
              <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
                <div className="rounded-[10px] bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Before
                  </p>
                  {c.before ?? 'Not in this plan'}
                </div>
                <div className="rounded-[10px] border border-accent/40 bg-accent-soft p-3">
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
    </Modal>
  );
}
