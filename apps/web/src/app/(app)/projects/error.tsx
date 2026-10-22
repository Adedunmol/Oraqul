'use client';

import { PageError } from '@/app/_workspace/route-states';

export default function RouteError({ retry }: { retry: () => void }) {
  return <PageError what="your projects" retry={retry} />;
}
