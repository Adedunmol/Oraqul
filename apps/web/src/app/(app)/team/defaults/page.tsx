import { Card, PageHead } from '@oraqul/ui';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getDefaults } from '@/lib/api/rules-server';
import { getTeam, getTeams } from '@/lib/api/teams-server';
import { CURRENT_TEAM_COOKIE, pickTeam } from '@/lib/current-team';
import { DefaultsScreen } from './_components/defaults-screen';

export const metadata: Metadata = { title: 'Team defaults · Oraqul' };

export default async function DefaultsPage() {
  const remembered = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value;
  const { teams } = await getTeams('/team/defaults');
  const current = pickTeam(teams, remembered);
  if (!current) {
    return (
      <div className="flex max-w-5xl flex-col gap-8">
        <PageHead title="Team defaults" className="sticky-head" />
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-muted">You are not on a team yet.</p>
          <Link href="/team" className="text-accent underline underline-offset-2">
            Go to Team
          </Link>
        </Card>
      </div>
    );
  }
  const [detail, defaults] = await Promise.all([
    getTeam(current.id, '/team/defaults'),
    getDefaults(current.id, '/team/defaults'),
  ]);
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHead
        className="sticky-head"
        title="Team defaults"
        description="Tell Oraqul how every plan for your team should be written, in your own words."
      />
      <DefaultsScreen
        teamId={current.id}
        role={detail.myRole}
        text={defaults.text}
        rules={defaults.rules}
      />
    </div>
  );
}
