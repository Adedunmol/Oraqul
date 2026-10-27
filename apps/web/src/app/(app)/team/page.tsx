import { roleSchema } from '@oraqul/schema';
import { Card, PageHead } from '@oraqul/ui';
import { cookies } from 'next/headers';
import { getMe } from '@/lib/api/me';
import { getTeam, getTeams } from '@/lib/api/teams-server';
import { CURRENT_TEAM_COOKIE, pickTeam } from '@/lib/current-team';
import { roleHelp, roleLabels } from '@/lib/roles';
import { CreateTeamForm } from '../_components/create-team-form';
import { InviteForm } from './_components/invite-form';
import { InviteRow } from './_components/invite-row';
import { MemberRow } from './_components/member-row';
import { RenameTeam } from './_components/team-header';

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
  const pending = detail.invites.length;
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-4 p-5 min-[700px]:p-6">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent-soft font-display text-2xl font-semibold text-accent"
        >
          {detail.team.name.charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
          <h1 className="truncate font-display text-[clamp(24px,2.6vw,30px)] font-semibold leading-[1.1] tracking-[-0.025em]">
            {detail.team.name}
          </h1>
          <p className="text-[13.5px] text-muted">
            {count(detail.members.length, 'member')}
            {isOwner && pending > 0 ? `, ${pending} waiting to join` : ''}. You are{' '}
            {roleLabels[detail.myRole].toLowerCase()}.
          </p>
        </div>
        {isOwner ? <RenameTeam teamId={detail.team.id} name={detail.team.name} /> : null}
      </Card>

      <div className="grid items-start gap-8 min-[1000px]:grid-cols-[minmax(0,1fr)_340px]">
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
          </section>

          {isOwner ? (
            <section aria-labelledby="pending-title" className="flex flex-col gap-3">
              <SectionHead
                id="pending-title"
                title="Pending invites"
                note="Waiting for a reply. An invite works for 7 days."
              />
              {pending === 0 ? (
                <Card className="px-5 py-4 text-[13.5px] text-muted">
                  No pending invites. Invite someone and they will show here until they join.
                </Card>
              ) : (
                <Card>
                  <ul className="divide-y divide-line">
                    {detail.invites.map((invite) => (
                      <InviteRow key={invite.id} teamId={detail.team.id} invite={invite} />
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 min-[1000px]:sticky min-[1000px]:top-4">
          {isOwner ? (
            <section aria-labelledby="invite-title">
              <Card className="flex flex-col gap-5 p-5">
                <SectionHead
                  id="invite-title"
                  title="Invite someone"
                  note="They get an email with a link to join."
                />
                <InviteForm teamId={detail.team.id} />
              </Card>
            </section>
          ) : null}
          <section aria-labelledby="roles-title">
            <Card className="flex flex-col gap-4 p-5">
              <SectionHead
                id="roles-title"
                title="Roles"
                note={
                  isOwner
                    ? 'What each role can do.'
                    : 'Only owners can invite people or change roles.'
                }
              />
              <dl className="flex flex-col gap-3">
                {roleSchema.options.map((role) => (
                  <div key={role} className="flex flex-col gap-0.5">
                    <dt className="text-sm font-semibold">{roleLabels[role]}</dt>
                    <dd className="text-[13px] text-muted">{roleHelp[role]}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>
        </aside>
      </div>
    </div>
  );
}
