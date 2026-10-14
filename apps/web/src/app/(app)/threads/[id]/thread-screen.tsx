'use client';

import { NotInSession } from '@/app/_workspace/not-in-session';
import type { Viewer } from '@/lib/api/viewer';
import { useDemo } from '@/lib/demo/use-demo';
import { ProjectWorkspace } from '../../categories/[category]/projects/[id]/project-screen';

/** A thread's address opens its project's workspace with that chat selected. */
export function ThreadScreen({ id, viewer }: { id: string; viewer: Viewer }) {
  const thread = useDemo().threads.find((t) => t.id === id);
  if (!thread) return <NotInSession what="thread" />;
  return <ProjectWorkspace projectId={thread.projectId} threadId={id} viewer={viewer} />;
}
