import { getSharedOutput } from '@/lib/api/projects-server';
import { SharedScreen } from './shared-screen';

// Public and read only: the token is the access, so there is no session check.
export default async function SharedPage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;
  return <SharedScreen detail={await getSharedOutput(token)} />;
}
