import { outputTabKeySchema } from '@oraqul/schema';
import { getOutputDetail, getThreadDetail } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { OutputScreen } from './output-screen';

export default async function OutputPage({ params, searchParams }: PageProps<'/outputs/[id]'>) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const returnTo = `/outputs/${id}`;
  const [viewer, detail] = await Promise.all([getViewer(returnTo), getOutputDetail(id, returnTo)]);
  const chat = await getThreadDetail(detail.thread.id, returnTo);
  const initialTab = outputTabKeySchema.safeParse(tab);
  return (
    <OutputScreen
      key={id}
      detail={detail}
      chat={chat}
      initialTab={initialTab.success ? initialTab.data : undefined}
      viewer={viewer}
    />
  );
}
