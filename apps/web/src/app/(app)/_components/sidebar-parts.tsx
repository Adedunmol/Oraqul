import { getSidebarProjects } from '@/lib/api/projects-server';
import { getShellData } from '@/lib/api/shell';
import { MainNav } from './main-nav';
import { Palette } from './palette';
import { TeamSwitcher } from './team-switcher';
import { UserMenu } from './user-menu';

export async function SidebarNav() {
  const data = await getShellData();
  const teamId = data?.team?.team.id;
  const projects = teamId ? await getSidebarProjects(teamId) : undefined;
  return (
    <MainNav
      projects={projects?.projects ?? []}
      pins={projects?.pins ?? []}
      needsYou={projects?.needsYou ?? 0}
    />
  );
}

export async function SidebarPalette() {
  const data = await getShellData();
  const teamId = data?.team?.team.id;
  const projects = teamId ? await getSidebarProjects(teamId) : undefined;
  return <Palette projects={projects?.projects ?? []} />;
}

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
  return <UserMenu name={data.user.name} email={data.user.email} />;
}
