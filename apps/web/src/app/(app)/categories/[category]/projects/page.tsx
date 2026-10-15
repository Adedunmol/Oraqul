import { notFound } from 'next/navigation';
import { ProjectsScreen } from '@/app/_workspace/projects-screen';
import { getPins, getProjects } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { parseScope, projectsPath } from '@/lib/routes';

export default async function ProjectsPage({
  params,
}: PageProps<'/categories/[category]/projects'>) {
  const { category } = await params;
  const scope = parseScope(category);
  if (!scope) notFound();
  const returnTo = projectsPath(scope);
  const viewer = await getViewer(returnTo);
  const [projects, pins] = viewer.teamId
    ? await Promise.all([getProjects(viewer.teamId, scope, returnTo), getPins(returnTo)])
    : [[], []];
  return (
    <ProjectsScreen key={scope} scope={scope} viewer={viewer} projects={projects} pins={pins} />
  );
}
