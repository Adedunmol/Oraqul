'use client';

import type { Category, StartMode } from '@oraqul/schema';
import { buttonClassName, Card, Icon } from '@oraqul/ui';
import Link from 'next/link';
import { StartComposer } from '@/app/_workspace/start-composer';
import type { Viewer } from '@/lib/api/viewer';
import { overviewPath, projectsPath } from '@/lib/routes';

/**
 * The message box on its own page, for starting from a project list or the sidebar. It saves
 * nothing: the first message creates the project and its first thread.
 */
export function StartScreen({
  mode,
  category,
  viewer,
}: {
  mode?: StartMode;
  category?: Category;
  viewer: Viewer;
}) {
  const back = category ? projectsPath(category) : overviewPath;

  if (viewer.role === 'viewer') {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-3 p-6">
        <h1 className="font-display text-2xl font-semibold">Editors and owners start projects.</h1>
        <p className="text-muted">Ask an owner on your team to make you an editor.</p>
        <Link href={back} className={buttonClassName('primary', 'default', 'icon')}>
          <Icon name="back" className="size-4" />
          Go back
        </Link>
      </Card>
    );
  }

  return (
    <div className="view-enter flex flex-col gap-7">
      <header className="mx-auto flex w-full max-w-[760px] flex-col gap-2">
        <h1 className="font-display text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
          What are you working on?
        </h1>
      </header>
      <div className="mx-auto w-full max-w-[760px]">
        <StartComposer actor={viewer.name} category={category} mode={mode} autoFocus />
      </div>
    </div>
  );
}
