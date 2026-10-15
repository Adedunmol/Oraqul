import { OverviewScreen } from '@/app/_workspace/overview-screen';
import { getOverview } from '@/lib/api/projects-server';
import { getViewer } from '@/lib/api/viewer';
import { overviewPath } from '@/lib/routes';

export default async function OverviewPage() {
  const viewer = await getViewer(overviewPath);
  const overview = viewer.teamId
    ? await getOverview(viewer.teamId, overviewPath)
    : { needsYou: [], threads: [] };
  return <OverviewScreen viewer={viewer} overview={overview} />;
}
