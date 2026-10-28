import { Card, PageHead } from '@oraqul/ui';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { apiUrl } from '@/lib/api/http';
import { getTeams } from '@/lib/api/teams-server';
import { getTokens } from '@/lib/api/tokens-server';
import { CURRENT_TEAM_COOKIE, pickTeam } from '@/lib/current-team';
import { ConnectionsScreen } from './_components/connections-screen';

export const metadata: Metadata = { title: 'Connections · Oraqul' };

export default async function ConnectionsPage() {
  const remembered = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value;
  const { teams } = await getTeams('/settings/connections');
  const current = pickTeam(teams, remembered);
  if (!current) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        <PageHead title="Connections" className="sticky-head" />
        <Card className="p-5">
          <p className="text-muted">
            You are not on a team yet.{' '}
            <Link href="/team" className="text-accent underline underline-offset-2">
              Go to Team
            </Link>
          </p>
        </Card>
      </div>
    );
  }
  const { tokens } = await getTokens(current.id, '/settings/connections');
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHead
        className="sticky-head"
        title="Connections"
        description={`Let Claude, ChatGPT or another agent use Oraqul for ${current.name}, with a personal token.`}
      />
      <ConnectionsScreen
        teamId={current.id}
        serverUrl={apiUrl('/mcp').toString()}
        tokens={tokens}
      />
    </div>
  );
}
