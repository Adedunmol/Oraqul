import { Logo } from '@oraqul/ui';
import { type ReactNode, Suspense } from 'react';
import { SignOutButton } from '../_components/sign-out-button';
import { NavLink } from './_components/nav-link';
import { SidebarTeam, SidebarUser, TeamNavLink } from './_components/sidebar-parts';
import { ThemeToggle } from './_components/theme-toggle';

const groupLabel = 'px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

const lineSkeleton = (width: string) => (
  <div className={`h-4 ${width} rounded-md bg-surface2 motion-safe:animate-pulse`} />
);

// Each data part sits in its own Suspense boundary, so the nav and the page never wait for it.
// This is the one place a layout reads data: docs/frontend/data.md.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 p-4 min-[900px]:flex">
        <div className="px-3 pt-1">
          <Logo />
        </div>
        <Suspense
          fallback={<div className="h-[62px] rounded-2xl bg-surface2 motion-safe:animate-pulse" />}
        >
          <SidebarTeam />
        </Suspense>
        <nav aria-label="Main" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <NavLink href="/projects" icon="projects">
              All projects
            </NavLink>
          </div>
          <div className="flex flex-col gap-1">
            <p className={groupLabel}>Manage</p>
            <Suspense
              fallback={
                <NavLink href="/team" icon="team">
                  Team
                </NavLink>
              }
            >
              <TeamNavLink />
            </Suspense>
          </div>
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
          <Suspense
            fallback={
              <div className="flex flex-col gap-2 px-1">
                {lineSkeleton('w-28')}
                {lineSkeleton('w-40')}
              </div>
            }
          >
            <SidebarUser />
          </Suspense>
          <div className="flex flex-wrap gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 min-[900px]:hidden">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1">
          <NavLink href="/projects" icon="projects">
            Projects
          </NavLink>
          <NavLink href="/team" icon="team">
            Team
          </NavLink>
        </nav>
      </header>

      <main className="border-t border-line bg-surface p-[clamp(20px,3vw,40px)] min-[900px]:mr-2 min-[900px]:mb-2 min-[900px]:rounded-[20px] min-[900px]:border">
        <div className="flex w-full flex-col gap-8">
          {children}
          <div className="flex flex-wrap gap-2 min-[900px]:hidden">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </main>
    </div>
  );
}
