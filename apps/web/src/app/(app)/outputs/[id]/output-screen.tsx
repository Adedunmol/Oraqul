'use client';

import type { OutputDetail, OutputTabKey, ThreadDetail } from '@oraqul/schema';
import { useRouter } from 'next/navigation';
import { LiveChat } from '@/app/_workspace/chat/live-chat';
import { OutputView } from '@/app/_workspace/output/output-view';
import type { Viewer } from '@/lib/api/viewer';

/** A saved output from the API, with its chat in the dock so follow ups happen beside it. */
export function OutputScreen({
  detail,
  chat,
  initialTab,
  viewer,
}: {
  detail: OutputDetail;
  chat: ThreadDetail;
  initialTab: OutputTabKey | undefined;
  viewer: Viewer;
}) {
  const router = useRouter();
  const canEdit = viewer.role !== 'viewer';
  return (
    <div className="flex flex-col gap-5" data-cat={detail.project.category}>
      <OutputView
        detail={detail}
        initialTab={initialTab}
        canEdit={canEdit}
        teamName={viewer.teamName}
        dock={{
          unread: false,
          chat: (
            <LiveChat detail={chat} canEdit={canEdit} onProjectUpdated={() => router.refresh()} />
          ),
        }}
      />
    </div>
  );
}
