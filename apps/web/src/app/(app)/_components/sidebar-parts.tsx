import { getShellData } from '@/lib/api/shell';
import { NavLink } from './nav-link';
import { TeamSwitcher } from './team-switcher';

export async function SidebarTeam() {
  const data = await getShellData();
  if (!data) return null;
  const { team } = data;
  return (
    <TeamSwitcher
      teams={data.teams}
      current={
        team
          ? {
              id: team.team.id,
              name: team.team.name,
              role: team.myRole,
              memberCount: team.members.length,
            }
          : undefined
      }
    />
  );
}

export async function TeamNavLink() {
  const data = await getShellData();
  const count = data?.team?.members.length;
  return (
    <NavLink
      href="/team"
      icon="team"
      badge={count === undefined ? undefined : { value: count, label: 'members' }}
    >
      Team
    </NavLink>
  );
}

export async function SidebarUser() {
  const data = await getShellData();
  if (!data) return null;
  return (
    <div className="flex min-w-0 flex-col px-1">
      <span className="truncate text-sm font-semibold">{data.user.name}</span>
      <span className="truncate text-[13px] text-muted">{data.user.email}</span>
    </div>
  );
}
