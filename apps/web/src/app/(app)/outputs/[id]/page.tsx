import { outputTabKeySchema } from '@oraqul/schema';
import { getCampaign, getOutputDetail, getThreadDetail, getWatch } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { OutputScreen } from './output-screen';

export default async function OutputPage({ params, searchParams }: PageProps<'/outputs/[id]'>) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const returnTo = `/outputs/${id}`;
  const [viewer, detail] = await Promise.all([getViewer(returnTo), getOutputDetail(id, returnTo)]);
  const hasCampaign = detail.output.tabs.some((t) => t.key === 'campaign');
  const hasWatch = detail.output.tabs.some((t) => t.key === 'watch');
  const [chat, campaign, watch] = await Promise.all([
    getThreadDetail(detail.thread.id, returnTo),
    hasCampaign ? getCampaign(id, returnTo) : null,
    hasWatch ? getWatch(id, returnTo) : null,
  ]);
  const initialTab = outputTabKeySchema.safeParse(tab);
  return (
    <OutputScreen
      key={id}
      detail={detail}
      chat={chat}
      campaign={campaign}
      watch={watch}
      initialTab={initialTab.success ? initialTab.data : undefined}
      viewer={viewer}
    />
  );
}
