import { notFound, redirect } from 'next/navigation';
import { getProjectDetail, getThreadDetail } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { parseScope, projectPath } from '@/lib/routes';
import { ProjectWorkspace } from './project-screen';

/** The project's address opens its newest chat. */
export default async function ProjectPage({
  params,
}: PageProps<'/categories/[category]/projects/[id]'>) {
  const { category, id } = await params;
  const scope = parseScope(category);
  if (!scope) notFound();
  const returnTo = `/categories/${scope}/projects/${id}`;
  const [viewer, detail] = await Promise.all([
    getViewer(returnTo),
    getProjectDetail(id, returnTo),
  ]);
  const newest = detail.threads[0]?.thread.id;
  const { project } = detail;
  // A draft has no category yet, so it lives at its chat's address until the router reads it.
  if (project.category === null) {
    if (newest) redirect(`/threads/${newest}`);
    notFound();
  }
  // A project has one address, under its own category. `all` and a wrong category both move there.
  if (project.category !== scope) redirect(projectPath({ id, category: project.category }));
  const chat = newest ? await getThreadDetail(newest, returnTo) : null;
  return <ProjectWorkspace key={id} detail={detail} chat={chat} viewer={viewer} />;
}
