'use client';

import type { OutputTabKey } from '@oraqul/schema';
import { useEffect, useMemo } from 'react';
import { NotInSession } from '@/app/_workspace/not-in-session';
import { OutputView } from '@/app/_workspace/output/output-view';
import type { Viewer } from '@/lib/api/viewer';
import { setActor } from '@/lib/demo/actions';
import { getOutputDetail, getThreadDetail, shareState } from '@/lib/demo/queries';
import { useDemo } from '@/lib/demo/use-demo';

export function OutputScreen({
  id,
  initialTab,
  viewer,
}: {
  id: string;
  initialTab: OutputTabKey | undefined;
  viewer: Viewer;
}) {
  const state = useDemo();
  const detail = useMemo(() => getOutputDetail(state, id), [state, id]);
  const thread = useMemo(
    () => (detail ? getThreadDetail(state, detail.thread.id) : undefined),
    [state, detail],
  );

  useEffect(() => setActor(viewer.name), [viewer.name]);

  if (!detail || !thread) return <NotInSession what="output" />;
  return (
    <div className="flex flex-col gap-5" data-cat={detail.project.category}>
      <OutputView
        key={id}
        detail={detail}
        initialTab={initialTab}
        canEdit={viewer.role !== 'viewer'}
        teamName={viewer.teamName}
        share={shareState(state, id)}
        dock={{ thread, unread: state.unread[thread.thread.id] === true }}
      />
    </div>
  );
}
