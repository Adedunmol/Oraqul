import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/api/viewer';
import { parseScope } from '@/lib/routes';
import { ProjectScreen } from './project-screen';

export default async function ProjectPage({
  params,
}: PageProps<'/categories/[category]/projects/[id]'>) {
  const { category, id } = await params;
  const scope = parseScope(category);
  if (!scope) notFound();
  const viewer = await getViewer(`/categories/${scope}/projects/${id}`);
  return <ProjectScreen key={id} id={id} scope={scope} viewer={viewer} />;
}
