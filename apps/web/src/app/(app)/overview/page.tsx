import { OverviewScreen } from '@/app/_workspace/overview-screen';
import { getViewer } from '@/lib/api/viewer';
import { overviewPath } from '@/lib/routes';

// Projects, threads and outputs come from the demo backend (lib/demo). The viewer is real.
export default async function OverviewPage() {
  const viewer = await getViewer(overviewPath);
  return <OverviewScreen viewer={viewer} />;
}
