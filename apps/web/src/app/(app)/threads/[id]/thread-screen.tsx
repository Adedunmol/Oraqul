'use client';

import { buttonClassName, Tabs } from '@oraqul/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChartCard, StackedColumns } from '@/app/_workspace/charts';
import { ChatPanel, KindTag } from '@/app/_workspace/chat/chat-panel';
import { Crumbs } from '@/app/_workspace/crumbs';
import { DemoNote } from '@/app/_workspace/demo-note';
import { formatDay } from '@/app/_workspace/format';
import { NotInSession } from '@/app/_workspace/not-in-session';
import type { Viewer } from '@/lib/api/viewer';
import { setActor } from '@/lib/demo/actions';
import { getCategory } from '@/lib/demo/catalog';
import { getThreadDetail, planOutputs } from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';
import { projectPath, projectsPath } from '@/lib/routes';
import { builtOnText } from '../../categories/[category]/projects/[id]/project-screen';

type Tab = 'chat' | 'details';

export function ThreadScreen({ id, viewer }: { id: string; viewer: Viewer }) {
  const state = useDemo();
  const detail = useMemo(() => getThreadDetail(state, id), [state, id]);
  const [tab, setTab] = useState<Tab>('chat');
  const canEdit = viewer.role !== 'viewer';

  useEffect(() => setActor(viewer.name), [viewer.name]);

  if (!detail) return <NotInSession what="thread" />;
  const { thread, project, outputs, projectOutputs } = detail;
  const info = getCategory(project.category);
  const labels = new Map(projectOutputs.map((o) => [o.id, o.label]));
  const plans = planOutputs(outputs);

  return (
    <div className="flex flex-col gap-6" data-cat={project.category}>
      <DemoNote />
      <header className="view-enter flex flex-col gap-4">
        <Crumbs
          items={[
            { label: info.name, href: projectsPath(project.category) },
            { label: project.name, href: projectPath(project) },
            { label: thread.name },
          ]}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Thread · {builtOnText(thread, labels)}
        </p>
        <h1 className="font-display text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
          {thread.name}
        </h1>
        <Tabs
          label="Thread sections"
          selected={tab}
          onSelect={setTab}
          items={[
            { key: 'chat', label: 'Chat' },
            { key: 'details', label: 'Details', count: outputs.length },
          ]}
        />
      </header>
      {tab === 'chat' ? (
        <div className="mx-auto flex h-[calc(100dvh-300px)] min-h-[440px] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-card">
          <ChatPanel detail={detail} canEdit={canEdit} />
        </div>
      ) : (
        <div className="tab-enter flex flex-col gap-[18px]">
          <section className="rounded-2xl bg-card px-5 py-[18px]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
              <div>
                <h3 className="text-[15px] font-semibold">Context</h3>
                <p className="text-[13px] text-muted">
                  What the agent pulled in when this thread started.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab('chat')}
                className={buttonClassName('default', 'small')}
              >
                Open chat
              </button>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px] min-[900px]:grid-cols-[150px_minmax(0,1fr)]">
              <dt className="text-muted">Started by</dt>
              <dd>
                {thread.createdBy}, {formatDay(thread.createdAt)}
              </dd>
              <dt className="text-muted">Working on</dt>
              <dd>{builtOnText(thread, labels)}</dd>
              <dt className="text-muted">Project inputs</dt>
              <dd>
                {[project.name, info.name.toLowerCase(), project.kind.toLowerCase()]
                  .filter(Boolean)
                  .join(', ')}
                , comps: {project.comps.join(', ') || 'none given'}
              </dd>
              <dt className="text-muted">Outputs</dt>
              <dd>{outputs.length}</dd>
            </dl>
          </section>
          {plans.length > 1 ? (
            <ChartCard
              title="Verdicts across this thread"
              note="Each column is one plan output from this thread."
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
              <StackedColumns
                columns={plans.map((o) => ({ label: o.shortLabel, counts: o.counts }))}
              />
            </ChartCard>
          ) : null}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-base font-semibold">Outputs</h3>
            {outputs.length ? (
              outputs.map((o) => (
                <div
                  key={o.id}
                  className="grid grid-cols-1 items-start gap-2.5 rounded-xl bg-card px-4 py-3 min-[900px]:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <KindTag kind={o.kind} label={o.kindLabel} /> {o.label}
                    </h4>
                    <p className="text-[13px] text-muted">{o.headline}</p>
                    <p className="text-[13px] text-muted">
                      {o.createdBy}, {formatDay(o.createdAt)} · {o.evidence.length} evidence lines
                    </p>
                  </div>
                  <Link href={`/outputs/${o.id}`} className={buttonClassName('primary', 'small')}>
                    View full details
                  </Link>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-card p-7 text-center text-muted">
                No outputs yet. Ask the agent for something in the chat.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
