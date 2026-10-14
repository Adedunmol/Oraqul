'use client';

import { type OutputTabKey, planKinds } from '@oraqul/schema';
import { Button, buttonClassName, TabNote, Tabs } from '@oraqul/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useMemo, useState } from 'react';
import { whatIf } from '@/lib/demo/actions';
import { getCategory } from '@/lib/demo/catalog';
import type { OutputDetail, ThreadDetail } from '@/lib/demo/queries';
import { projectPath, projectsPath } from '@/lib/routes';
import { ChatPanel, KindTag } from '../chat/chat-panel';
import { Crumbs } from '../crumbs';
import { formatDay } from '../format';
import { copyText, toast } from '../toast';
import { makeView, OutputContext } from './context';
import { ExportModal, ShareModal } from './modals';
import { ReceiptDrawer } from './receipt-drawer';
import {
  AssumptionsTab,
  AudienceTab,
  CannotTab,
  ChangesTab,
  DateTab,
  EvidenceTab,
  PartnersTab,
  PlanTab,
  ResultsTab,
  RisksTab,
  SummaryTab,
} from './tabs-core';
import {
  BridgeTab,
  FanBaseTab,
  RegionsTab,
  RouteTab,
  ShelfTab,
  SupportActsTab,
  TerritoriesTab,
  TopicsTab,
} from './tabs-signature';

const TAB_BODY: Record<OutputTabKey, () => ReactNode> = {
  summary: SummaryTab,
  audience: AudienceTab,
  assumptions: AssumptionsTab,
  plan: PlanTab,
  risks: RisksTab,
  cannot: CannotTab,
  evidence: EvidenceTab,
  changes: ChangesTab,
  results: ResultsTab,
  date: DateTab,
  partners: PartnersTab,
  territories: TerritoriesTab,
  route: RouteTab,
  supportacts: SupportActsTab,
  shelf: ShelfTab,
  bridge: BridgeTab,
  topics: TopicsTab,
  fanbase: FanBaseTab,
  regions: RegionsTab,
};

const PRIMARY: OutputTabKey[] = ['summary', 'plan', 'assumptions', 'evidence'];
const WHAT_IF_TABS: OutputTabKey[] = [
  'summary',
  'audience',
  'assumptions',
  'plan',
  'territories',
  'route',
  'supportacts',
  'shelf',
  'bridge',
  'topics',
  'fanbase',
  'regions',
];

type TabChoice = OutputTabKey | 'more';

export function OutputView({
  detail,
  initialTab,
  canEdit,
  teamName,
  share,
  dock,
}: {
  detail: OutputDetail;
  initialTab: OutputTabKey | undefined;
  canEdit: boolean;
  teamName: string | null;
  /** Present in the app. Absent on a shared link, which is read only. */
  share?: { token: string; enabled: boolean };
  dock?: { thread: ThreadDetail; unread: boolean };
}) {
  const { output, project, thread, builtOn } = detail;
  const router = useRouter();
  const shared = !share;
  const keys = output.tabs.map((t) => t.key);
  const [tab, setTab] = useState<OutputTabKey>(
    initialTab && keys.includes(initialTab) ? initialTab : 'summary',
  );
  const [more, setMore] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [modal, setModal] = useState<'share' | 'export' | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const category = getCategory(project.category);

  // The URL keeps the tab so a link opens it, without a server round trip for every click.
  const goToTab = useCallback((key: OutputTabKey) => {
    setTab(key);
    window.history.replaceState(null, '', key === 'summary' ? '?' : `?tab=${key}`);
  }, []);

  const view = useMemo(
    () =>
      makeView(output, {
        openReceipt: setReceipt,
        openExport: () => setModal('export'),
        goToTab,
        builtOn: builtOn ? { id: builtOn.id, label: builtOn.label } : undefined,
        canEdit: canEdit && !shared,
        shared,
      }),
    [output, builtOn, canEdit, shared, goToTab],
  );

  const all = output.tabs;
  const collapsible = all.length > 5;
  const visible =
    collapsible && !more ? all.filter((t) => PRIMARY.includes(t.key) || t.key === tab) : all;
  const hidden = all.length - visible.length;
  const items: { key: TabChoice; label: string; count?: number }[] = visible.map((t) => ({
    key: t.key,
    label: t.label,
    count: t.key === 'evidence' ? output.evidence.length : undefined,
  }));
  if (collapsible) items.push({ key: 'more', label: more ? 'Fewer' : `More (${hidden})` });

  const current = all.find((t) => t.key === tab);
  const Body = TAB_BODY[tab];
  const isPlan = (planKinds as readonly string[]).includes(output.kind);
  const showWhatIf = view.canEdit && isPlan && WHAT_IF_TABS.includes(tab) && dock;

  async function onWhatIf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('what-if');
    const text = input instanceof HTMLInputElement ? input.value.trim() : '';
    if (!text) {
      toast('Type a change or pick one of the presets');
      return;
    }
    if (dock?.thread.busy) {
      toast('The agent is working');
      return;
    }
    setDockOpen(true);
    const next = await whatIf(thread.id, output.id, text);
    if (next) router.push(`/outputs/${next}`);
  }

  const crumbs = [
    { label: category.name, href: projectsPath(project.category) },
    { label: project.name, href: projectPath(project) },
    { label: thread.name, href: `/threads/${thread.id}` },
    { label: output.label },
  ];

  return (
    <OutputContext value={view}>
      <div
        className={`grid grid-cols-1 gap-6 ${dock && dockOpen ? 'min-[900px]:grid-cols-[minmax(0,1fr)_380px]' : ''}`}
      >
        <div className="view-enter flex min-w-0 flex-col gap-7">
          <header className="flex flex-col gap-3">
            {shared ? null : <Crumbs items={crumbs} />}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <KindTag kind={output.kind} label={output.kindLabel} />
                  <span>
                    {shared ? 'Shared brief · read only · ' : ''}Made in thread {thread.name} by{' '}
                    {output.createdBy}, {formatDay(output.createdAt)}
                    {builtOn ? ` · built on ${builtOn.label}` : ''}
                  </span>
                </p>
                <h1 className="font-display text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
                  {output.label}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {share && canEdit ? (
                  <Button className="max-[899px]:hidden" onClick={() => setModal('share')}>
                    Share
                  </Button>
                ) : null}
                <Button className="max-[899px]:hidden" onClick={() => setModal('export')}>
                  Export brief
                </Button>
                <Button onClick={() => copyText(output.summary, 'Summary copied')}>
                  Copy summary
                </Button>
                {shared ? null : (
                  <Link href={`/threads/${thread.id}`} className={buttonClassName('primary')}>
                    Open thread
                  </Link>
                )}
              </div>
            </div>
            <Tabs
              label="Output sections"
              items={items}
              selected={tab}
              onSelect={(key) => (key === 'more' ? setMore((m) => !m) : goToTab(key))}
            />
          </header>
          {current ? <TabNote>{current.note}</TabNote> : null}
          {showWhatIf ? (
            <form
              onSubmit={onWhatIf}
              className="flex flex-wrap items-center gap-2 rounded-[10px] bg-card px-3 py-2.5 max-[899px]:hidden"
            >
              <label
                htmlFor="what-if"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
              >
                What if
              </label>
              <input
                id="what-if"
                name="what-if"
                autoComplete="off"
                placeholder={`Try: ${category.scenarioExample}`}
                className="min-w-[180px] flex-1 rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45"
              />
              <Button type="submit" variant="primary" size="small">
                Test
              </Button>
            </form>
          ) : null}
          <div key={tab} className="tab-enter flex flex-col gap-[18px] pb-16">
            <Body />
          </div>
        </div>
        {dock && dockOpen ? (
          <aside
            aria-label="Agent chat"
            className="sticky top-4 hidden h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden rounded-2xl bg-card min-[900px]:flex"
          >
            <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
              <b className="truncate">Thread: {thread.name}</b>
              <Button size="small" variant="ghost" onClick={() => setDockOpen(false)}>
                Close
              </Button>
            </div>
            <ChatPanel detail={dock.thread} canEdit={canEdit} />
          </aside>
        ) : null}
      </div>
      {dock && !dockOpen ? (
        <Button
          variant="primary"
          onClick={() => setDockOpen(true)}
          className="fixed right-5 bottom-5 z-40 rounded-full px-[18px] py-2.5 shadow-[var(--shadow)] max-[899px]:hidden"
        >
          Ask in this thread
          {dock.unread ? (
            <span className="ml-1.5 rounded-full bg-bg px-[7px] py-px text-[11px] font-semibold text-ink">
              New
            </span>
          ) : null}
        </Button>
      ) : null}
      <ReceiptDrawer output={output} lineId={receipt} onClose={() => setReceipt(null)} />
      <ExportModal
        open={modal === 'export'}
        onClose={() => setModal(null)}
        output={output}
        project={project}
        teamName={teamName}
      />
      {share ? (
        <ShareModal
          open={modal === 'share'}
          onClose={() => setModal(null)}
          share={{ outputId: output.id, ...share }}
        />
      ) : null}
    </OutputContext>
  );
}
