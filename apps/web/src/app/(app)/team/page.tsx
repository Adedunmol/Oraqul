import { Card, Chip, PageHead } from '@oraqul/ui';
import { cookies } from 'next/headers';
import { getMe } from '@/lib/api/me';
import { getTeam, getTeams } from '@/lib/api/teams-server';
import { CURRENT_TEAM_COOKIE, pickTeam } from '@/lib/current-team';
import { roleHelp, roleLabels } from '@/lib/roles';
import { CreateTeamForm } from '../_components/create-team-form';
import { InviteForm } from './_components/invite-form';
import { MemberRow } from './_components/member-row';

function SectionHead({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 id={id} className="font-display text-[16px] font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      <p className="text-[13px] text-muted">{note}</p>
    </div>
  );
}

function Initial({ name, quiet }: { name: string; quiet?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-semibold ${quiet ? 'bg-surface2 text-muted' : 'bg-accent-soft text-accent'}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default async function TeamPage() {
  const remembered = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value;
  const [{ user }, { teams }] = await Promise.all([getMe('/team'), getTeams('/team')]);
  const current = pickTeam(teams, remembered);

  if (!current) {
    return (
      <div className="flex max-w-5xl flex-col gap-8">
        <PageHead title="Team" className="sticky-head" />
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
    <div className="flex max-w-5xl flex-col gap-8">
      <PageHead
        className="sticky-head"
        title={detail.team.name}
        description={`You are ${roleLabels[detail.myRole].toLowerCase()}. ${roleHelp[detail.myRole]}`}
      />

      <div
        className={
          isOwner ? 'grid items-start gap-8 min-[1000px]:grid-cols-[minmax(0,1fr)_340px]' : ''
        }
      >
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="members-title" className="flex flex-col gap-3">
            <SectionHead
              id="members-title"
              title="Members"
              note="Everyone who can open this team's projects."
            />
            <Card>
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
              <p className="text-[13px] text-muted">
                Only owners can invite people or change roles.
              </p>
            )}
          </section>

          {isOwner ? (
            <section aria-labelledby="pending-title" className="flex flex-col gap-3">
              <SectionHead
                id="pending-title"
                title="Pending invites"
                note="Waiting for a reply. An invite works for 7 days."
              />
              {detail.invites.length === 0 ? (
                <Card className="px-5 py-4 text-[13.5px] text-muted">
                  No pending invites. Invite someone and they will show here until they join.
                </Card>
              ) : (
                <Card>
                  <ul className="divide-y divide-line">
                    {detail.invites.map((invite) => (
                      <li key={invite.id} className="flex items-center gap-4 px-5 py-4">
                        <Initial name={invite.email} quiet />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{invite.email}</p>
                          <p className="text-[13px] text-muted">
                            Expires{' '}
                            {new Date(invite.expiresAt).toLocaleDateString('en', {
                              dateStyle: 'medium',
                            })}
                          </p>
                        </div>
                        <Chip>{roleLabels[invite.role]}</Chip>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          ) : null}
        </div>

        {isOwner ? (
          <aside aria-labelledby="invite-title" className="min-[1000px]:sticky min-[1000px]:top-4">
            <Card className="flex flex-col gap-5 p-5">
              <SectionHead
                id="invite-title"
                title="Invite someone"
                note="They get an email with a link to join."
              />
              <InviteForm teamId={detail.team.id} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
