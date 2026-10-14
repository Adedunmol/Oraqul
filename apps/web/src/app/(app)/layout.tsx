import { Logo } from '@oraqul/ui';
import { type ReactNode, Suspense } from 'react';
import { SignOutButton } from '../_components/sign-out-button';
import { Toaster } from '../_workspace/toast';
import { Tooltip } from '../_workspace/tooltip';
import { MainNav, MobileNav } from './_components/main-nav';
import { NavLink } from './_components/nav-link';
import { Palette, SearchButton } from './_components/palette';
import { SidebarTeam, SidebarUser } from './_components/sidebar-parts';
import { SidebarToggle } from './_components/sidebar-toggle';
import { ThemeToggle } from './_components/theme-toggle';

const groupLabel = 'px-3 text-[12px] font-semibold text-muted rail:sr-only';

const lineSkeleton = (width: string) => (
  <div className={`h-4 ${width} rounded-md bg-surface2 motion-safe:animate-pulse`} />
);

const navSkeleton = (
  <div className="flex flex-col gap-1.5">
    {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
      <div key={key} className="h-10 rounded-lg bg-surface2 motion-safe:animate-pulse" />
    ))}
  </div>
);

// Each data part sits in its own Suspense boundary, so the nav and the page never wait for it.
// This is the one place a layout reads data: docs/frontend/data.md.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell flex min-h-dvh flex-col">
      {/* In the rail nothing scrolls, so the team menu can open past its edge. */}
      <aside
        data-rail
        aria-label="Sidebar"
        className="sticky top-0 z-30 hidden h-dvh flex-col gap-5 overflow-x-hidden overflow-y-auto p-4 min-[900px]:flex rail:overflow-visible rail:px-2.5"
      >
        <div className="flex items-center justify-between gap-2 pl-3 rail:flex-col rail:pl-0">
          <Logo wordmarkClassName="rail:sr-only" />
          <SidebarToggle />
        </div>
        <Suspense
          fallback={
            <div className="h-[62px] rounded-2xl bg-surface2 motion-safe:animate-pulse rail:h-10" />
          }
        >
          <SidebarTeam />
        </Suspense>
        <SearchButton />
        {/* The nav reads the URL to light the current item, which is only known at request time. */}
        <Suspense fallback={navSkeleton}>
          <nav aria-label="Main" className="flex flex-col gap-5">
            <MainNav />
            <div className="flex flex-col gap-1 rail:pt-3">
              <p className={groupLabel}>Manage</p>
              <NavLink href="/team" icon="team">
                Team
              </NavLink>
            </div>
          </nav>
        </Suspense>
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
          <div className="flex flex-wrap gap-2 rail:flex-col rail:items-center">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <header className="flex items-center justify-between gap-3 px-4 py-2.5 min-[900px]:hidden">
        <Logo />
        <Suspense fallback={<div className="h-10 w-48 rounded-lg bg-surface2" />}>
          <nav aria-label="Main" className="flex items-center gap-1">
            <MobileNav search={<SearchButton />} />
          </nav>
        </Suspense>
      </header>

      <main className="flex-1 border-t border-line bg-canvas px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2vw,28px)] min-[900px]:my-2 min-[900px]:mr-2 min-[900px]:rounded-2xl min-[900px]:border">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
          {children}
          <div className="flex flex-wrap gap-2 min-[900px]:hidden">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </main>
      <Palette />
      <Tooltip />
      <Toaster />
    </div>
  );
}
