import { getViewer } from '@/lib/api/viewer';
import { ThreadScreen } from './thread-screen';

export default async function ThreadPage({ params }: PageProps<'/threads/[id]'>) {
  const { id } = await params;
  const viewer = await getViewer(`/threads/${id}`);
  return <ThreadScreen key={id} id={id} viewer={viewer} />;
}
