import { notFound } from 'next/navigation';
import { ProjectsScreen } from '@/app/_workspace/projects-screen';
import { getViewer } from '@/lib/api/viewer';
import { parseScope, projectsPath } from '@/lib/routes';

// Projects come from the demo backend (lib/demo) until GET /projects exists. The viewer is real.
export default async function ProjectsPage({
  params,
}: PageProps<'/categories/[category]/projects'>) {
  const { category } = await params;
  const scope = parseScope(category);
  if (!scope) notFound();
  const viewer = await getViewer(projectsPath(scope));
  return <ProjectsScreen key={scope} scope={scope} viewer={viewer} />;
}
