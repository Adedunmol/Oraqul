import { buttonClassName, Card, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { projectsPath } from '@/lib/routes';

/**
 * Demo data lives in this browser tab. Something made earlier in the session is gone after a
 * reload, and an unknown id looks the same, so say both plainly.
 */
export function NotInSession({ what }: { what: string }) {
  return (
    <Card className="flex max-w-xl flex-col items-start gap-3 p-6">
      <h1 className="font-display text-2xl font-semibold">We could not find this {what}.</h1>
      <p className="text-muted">
        The demo keeps new work only until the page reloads, and the link may be wrong. The sample
        projects are always there.
      </p>
      <Link href={projectsPath()} className={buttonClassName('primary', 'default', 'icon')}>
        <Icon name="projects" className="size-4" />
        All projects
      </Link>
    </Card>
  );
}
