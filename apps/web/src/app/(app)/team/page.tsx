import { Card, PageHead } from '@oraqul/ui';
import { cookies } from 'next/headers';
import { getMe } from '@/lib/api/me';
import { getTeam, getTeams } from '@/lib/api/teams-server';
import { CURRENT_TEAM_COOKIE, pickTeam } from '@/lib/current-team';
import { roleHelp, roleLabels } from '@/lib/roles';
import { CreateTeamForm } from '../_components/create-team-form';
import { InviteForm } from './_components/invite-form';
import { MemberRow } from './_components/member-row';

const label = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

export default async function TeamPage() {
  const remembered = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value;
  const [{ user }, { teams }] = await Promise.all([getMe('/team'), getTeams('/team')]);
  const current = pickTeam(teams, remembered);

  if (!current) {
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <PageHead title="Team" />
        <Card className="flex flex-col items-start gap-4 p-5">
          <p className="text-muted">You are not on a team yet. Create one to get started.</p>
          <CreateTeamForm />
        </Card>
      </div>
    );
  }

  const detail = await getTeam(current.id, '/team');
  const isOwner = detail.myRole === 'owner';

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHead
        label="Team"
        title={detail.team.name}
        description={`You are ${roleLabels[detail.myRole].toLowerCase()}. ${roleHelp[detail.myRole]}`}
      />

      <section aria-labelledby="members-title" className="flex flex-col gap-3">
        <h2 id="members-title" className={label}>
          Members ({detail.members.length})
        </h2>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {detail.members.map((member) => (
              <MemberRow
                key={member.userId}
                teamId={detail.team.id}
                member={member}
                isMe={member.userId === user.id}
                canManage={isOwner}
              />
            ))}
          </ul>
        </Card>
        {isOwner ? null : (
          <p className="text-[13px] text-muted">Only owners can invite people or change roles.</p>
        )}
      </section>

      {isOwner ? (
        <>
          <section aria-labelledby="invite-title" className="flex flex-col gap-3">
            <h2 id="invite-title" className={label}>
              Invite someone
            </h2>
            <Card>
              <InviteForm teamId={detail.team.id} />
            </Card>
          </section>

          <section aria-labelledby="pending-title" className="flex flex-col gap-3">
            <h2 id="pending-title" className={label}>
              Pending invites ({detail.invites.length})
            </h2>
            {detail.invites.length === 0 ? (
              <Card className="px-4 py-4 text-muted">
                No pending invites. Invite someone above and they will show here until they join.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {detail.invites.map((invite) => (
                    <li
                      key={invite.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold">{invite.email}</p>
                      <p className="text-[13px] text-muted">
                        {roleLabels[invite.role]} · expires{' '}
                        {new Date(invite.expiresAt).toLocaleDateString('en', {
                          dateStyle: 'medium',
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
