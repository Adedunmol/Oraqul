import { outputTabKeySchema } from '@oraqul/schema';
import { getViewer } from '@/lib/api/viewer';
import { OutputScreen } from './output-screen';

export default async function OutputPage({ params, searchParams }: PageProps<'/outputs/[id]'>) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer(`/outputs/${id}`);
  const initialTab = outputTabKeySchema.safeParse(tab);
  return (
    <OutputScreen
      key={id}
      id={id}
      initialTab={initialTab.success ? initialTab.data : undefined}
      viewer={viewer}
    />
  );
}
