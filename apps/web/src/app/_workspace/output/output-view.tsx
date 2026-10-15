'use client';

import type { OutputTabKey } from '@oraqul/schema';
import { Button, buttonClassName, Icon, TabNote, Tabs } from '@oraqul/ui';
import Link from 'next/link';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { OutputDetail, ThreadDetail } from '@/lib/demo/queries';
import { projectPath, projectsPath } from '@/lib/routes';
import { ChatPanel, KindTag } from '../chat/chat-panel';
import { Crumbs } from '../crumbs';
import { formatDay } from '../format';
import { copyText } from '../toast';
import { makeView, OutputContext } from './context';
import { ExportModal, ShareModal } from './modals';
import { ReceiptDrawer } from './receipt-drawer';
import {
  AssumptionsTab,
  AudienceTab,
  ChangesTab,
  DateTab,
  EvidenceTab,
  PartnersTab,
  PlanTab,
  ResultsTab,
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
  // No output lists these two any more; their lists sit at the end of Plan and Assumptions.
  risks: PlanTab,
  cannot: AssumptionsTab,
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
/** Tabs that became part of another, so an old link still lands on the right list. */
const FOLDED: Partial<Record<OutputTabKey, OutputTabKey>> = {
  risks: 'plan',
  cannot: 'assumptions',
};

type TabChoice = OutputTabKey | 'more';

export function OutputView({
  detail,
  initialTab,
  canEdit,
  teamName,
  share,
  dock,
  publicExample = false,
}: {
  detail: OutputDetail;
  initialTab: OutputTabKey | undefined;
  canEdit: boolean;
  teamName: string | null;
  /** Present in the app. Absent on a shared link, which is read only. */
  share?: { token: string; enabled: boolean };
  dock?: { thread: ThreadDetail; unread: boolean };
  /** The public example page: the receipt drawer leaves out what could read as raw Qloo data. */
  publicExample?: boolean;
}) {
  const { output, project, thread, builtOn } = detail;
  const shared = !share;
  const keys = output.tabs.map((t) => t.key);
  const asked = initialTab ? (FOLDED[initialTab] ?? initialTab) : undefined;
  const [tab, setTab] = useState<OutputTabKey>(asked && keys.includes(asked) ? asked : 'summary');
  const [more, setMore] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [modal, setModal] = useState<'share' | 'export' | null>(null);
  const [dockOpen, setDockOpen] = useState(false);

  // The URL keeps the tab so a link opens it, without a server round trip for every click. Other
  // query values stay (the public examples page keeps its ?case= beside it).
  const goToTab = useCallback((key: OutputTabKey) => {
    setTab(key);
    const url = new URL(window.location.href);
    if (key === 'summary') url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    window.history.replaceState(null, '', url);
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

  // The title below already names this output, and the chat is one click away, so the trail
  // stops at the project.
  const crumbs = [
    { label: 'Projects', href: projectsPath() },
    { label: project.name, href: projectPath(project) },
  ];

  return (
    <OutputContext value={view}>
      <div
        className={`grid grid-cols-1 gap-6 ${dock && dockOpen ? 'min-[900px]:grid-cols-[minmax(0,1fr)_380px]' : ''}`}
      >
        <div className="view-enter flex min-w-0 flex-col gap-7">
          <header className="sticky-head flex flex-col gap-3">
            {shared ? null : <Crumbs items={crumbs} />}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="font-display text-[clamp(24px,2.8vw,32px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
                    {output.label}
                  </h1>
                  <KindTag kind={output.kind} label={output.kindLabel} />
                </div>
                <p className="text-[13px] text-muted">
                  {shared ? 'Shared brief, read only · ' : ''}
                  {output.createdBy}, {formatDay(output.createdAt)}
                  {shared ? '' : ` · in ${thread.name}`}
                  {builtOn ? ` · built on ${builtOn.label}` : ''}
                </p>
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
                  // On desktop the dock chat does this; below 900px the dock is hidden.
                  <Link
                    href={`/threads/${thread.id}`}
                    className={`${buttonClassName('primary')} min-[900px]:hidden`}
                  >
                    Open chat
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
              <b className="truncate">{thread.name}</b>
              <Button
                size="small"
                variant="ghost"
                onClick={() => setDockOpen(false)}
                aria-label="Close chat"
              >
                <Icon name="close" className="size-4" />
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
          className="fixed right-5 bottom-5 z-40 h-11! rounded-full px-[18px] shadow-[var(--shadow)]! max-[899px]:hidden"
        >
          Ask Oraqul
          {dock.unread ? (
            <span className="ml-1.5 rounded-full bg-bg px-[7px] py-px text-[11px] font-semibold text-ink">
              New
            </span>
          ) : null}
        </Button>
      ) : null}
      <ReceiptDrawer
        output={output}
        lineId={receipt}
        onClose={() => setReceipt(null)}
        publicExample={publicExample}
      />
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
