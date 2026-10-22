import { notFound, redirect } from 'next/navigation';
import { getProjectDetail, getThreadDetail } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { chatPath, projectPath } from '@/lib/routes';
import { ProjectWorkspace } from './project-screen';

/** The project's address opens its newest chat. */
export default async function ProjectPage({ params }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const returnTo = projectPath({ id });
  const [viewer, detail] = await Promise.all([getViewer(returnTo), getProjectDetail(id, returnTo)]);
  const newest = detail.threads[0]?.thread.id;
  // A draft has no category yet, so it lives at its chat's address until the router reads it.
  if (detail.project.category === null) {
    if (newest) redirect(chatPath(newest));
    notFound();
  }
  const chat = newest ? await getThreadDetail(newest, returnTo) : null;
  return <ProjectWorkspace key={id} detail={detail} chat={chat} viewer={viewer} />;
}
