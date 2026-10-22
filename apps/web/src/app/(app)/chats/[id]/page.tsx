import { getProjectDetail, getThreadDetail } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { chatPath } from '@/lib/routes';
import { ProjectWorkspace } from '../../projects/[id]/project-screen';

/** A chat's address opens its project's workspace with that chat selected. */
export default async function ChatPage({ params }: PageProps<'/chats/[id]'>) {
  const { id } = await params;
  const returnTo = chatPath(id);
  const [viewer, chat] = await Promise.all([getViewer(returnTo), getThreadDetail(id, returnTo)]);
  const detail = await getProjectDetail(chat.thread.projectId, returnTo);
  return <ProjectWorkspace key={id} detail={detail} chat={chat} viewer={viewer} />;
}
