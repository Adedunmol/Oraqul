import { getProjectDetail, getThreadDetail } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { ProjectWorkspace } from '../../categories/[category]/projects/[id]/project-screen';

/** A thread's address opens its project's workspace with that chat selected. */
export default async function ThreadPage({ params }: PageProps<'/threads/[id]'>) {
  const { id } = await params;
  const returnTo = `/threads/${id}`;
  const [viewer, chat] = await Promise.all([getViewer(returnTo), getThreadDetail(id, returnTo)]);
  const detail = await getProjectDetail(chat.thread.projectId, returnTo);
  return <ProjectWorkspace key={id} detail={detail} chat={chat} viewer={viewer} />;
}
