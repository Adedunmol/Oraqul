import Link from 'next/link';
import { getDemoProjects } from '@/lib/api/projects';

export default async function ProjectsPage() {
  const projects = await getDemoProjects();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-16">
      <h1 className="font-display text-[clamp(26px,3vw,34px)] font-medium leading-[1.1] tracking-[-0.015em]">
        Projects
      </h1>
      {projects.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-5">
          <p className="text-muted">No projects yet.</p>
          <Link href="/" className="font-semibold text-accent underline">
            Plan a launch
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map(({ id, project }) => (
            <li key={id} className="rounded-lg border border-line bg-surface p-5">
              <p className="font-semibold">{project.name}</p>
              <p className="text-muted">{project.lead}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
