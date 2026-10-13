import { Card, PageHead } from '@oraqul/ui';
import { getMe } from '@/lib/api/me';

// Reference route for the data pattern (docs/frontend/data.md). It reads the signed in person
// until GET /projects exists.
export default async function ProjectsPage() {
  const { user } = await getMe('/projects');

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHead title="Projects" description={`Signed in as ${user.name}.`} />
      <Card className="p-5">
        <p className="text-muted">No projects yet.</p>
      </Card>
    </div>
  );
}
