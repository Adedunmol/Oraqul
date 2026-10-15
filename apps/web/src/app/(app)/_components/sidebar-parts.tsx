import { getShellData } from '@/lib/api/shell';
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

export async function SidebarUser() {
  const data = await getShellData();
  if (!data) return null;
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-1 rail:justify-center rail:px-0">
      <span
        aria-hidden
        data-rail-tip={`${data.user.name}, ${data.user.email}`}
        className="hidden size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-ink rail:grid"
      >
        {data.user.name.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col rail:sr-only">
        <span className="truncate text-sm font-semibold">{data.user.name}</span>
        <span className="truncate text-[13px] text-muted">{data.user.email}</span>
      </div>
    </div>
  );
}
