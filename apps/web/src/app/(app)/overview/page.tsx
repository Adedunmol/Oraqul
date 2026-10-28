import { OverviewScreen } from '@/app/_workspace/overview-screen';
import { getOverview } from '@/lib/api/projects-server';
import { offerTeamSetup } from '@/lib/api/team-setup';
import { getViewer } from '@/lib/api/viewer';
import { overviewPath } from '@/lib/routes';

export default async function OverviewPage() {
  const viewer = await getViewer(overviewPath);
  const [overview, offerSetup] = await Promise.all([
    viewer.teamId
      ? getOverview(viewer.teamId, overviewPath)
      : Promise.resolve({ needsYou: [], threads: [] }),
    offerTeamSetup(viewer, overviewPath),
  ]);
  return <OverviewScreen viewer={viewer} overview={overview} offerSetup={offerSetup} />;
}
