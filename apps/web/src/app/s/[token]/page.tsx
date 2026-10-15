import { SharedScreen } from './shared-screen';

// Public and read only: no session needed. Share links are demo state until POST /outputs/:id/share.
export default async function SharedPage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;
  return <SharedScreen token={token} />;
}
