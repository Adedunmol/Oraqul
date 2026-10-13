import { getMe } from '@/lib/api/me';
import { SignOutButton } from '../_components/sign-out-button';

// Reference route for the data pattern (docs/frontend/data.md). It reads the signed in person
// until GET /projects exists.
export default async function ProjectsPage() {
  const { user } = await getMe('/projects');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-16">
      <h1 className="font-display text-[clamp(26px,3vw,34px)] font-medium leading-[1.1] tracking-[-0.015em]">
        Projects
      </h1>
      <p className="text-muted">Signed in as {user.name}.</p>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-5">
        <p className="text-muted">No projects yet.</p>
        <SignOutButton />
      </div>
    </main>
  );
}
