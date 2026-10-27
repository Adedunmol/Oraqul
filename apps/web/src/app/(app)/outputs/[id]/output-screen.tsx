'use client';

import type {
  CampaignState,
  OutputDetail,
  OutputTabKey,
  ThreadDetail,
  WatchState,
} from '@oraqul/schema';
import { useRouter } from 'next/navigation';
import { LiveChat } from '@/app/_workspace/chat/live-chat';
import { OutputView } from '@/app/_workspace/output/output-view';
import type { Viewer } from '@/lib/api/viewer';

/** A saved output from the API, with its chat in the dock so follow ups happen beside it. */
export function OutputScreen({
  detail,
  chat,
  campaign,
  watch,
  initialTab,
  viewer,
}: {
  detail: OutputDetail;
  chat: ThreadDetail;
  campaign: CampaignState | null;
  watch: WatchState | null;
  initialTab: OutputTabKey | undefined;
  viewer: Viewer;
}) {
  const router = useRouter();
  const canEdit = viewer.role !== 'viewer';
  return (
    <div className="flex flex-col gap-5" data-wide data-cat={detail.project.category}>
      <OutputView
        detail={detail}
        campaign={campaign}
        watch={watch}
        initialTab={initialTab}
        canEdit={canEdit}
        share={detail.share ?? { token: null, enabled: false }}
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
