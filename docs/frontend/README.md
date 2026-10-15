# Frontend

Next.js App Router in `apps/web`. The look is defined in [design-system.md](design-system.md). Turning it into code is in [components.md](components.md). Data, types and loading, error and empty states are in [data.md](data.md). Routes and screens are in [spec §9](../product/spec.md).

> `apps/web/AGENTS.md` (written by Next) warns that this Next.js version has breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before using a Next API you have not used in this repo.

## Rules

- Server components by default. Add `"use client"` only for state, effects, browser APIs or event handlers, and keep those components small and low in the tree.
- The web app talks to the API only, through the fetchers in `src/lib/api/` (they send the session cookie). It never imports `engine` or `packs`.
- Types come from `@oraqul/schema`. Parse API responses with its schemas inside the fetcher, see [typescript.md](../typescript.md).
- Reads happen in server components, writes in client components through typed helpers. Every data route has loading, error and empty states. Full rules in [data.md](data.md).
- Agent runs stream over server sent events. Render question cards, trace steps and messages from the event, and post answers back as messages.
- No literal colours, fonts or radii in components. Use tokens, see [components.md](components.md).
- Words follow [design-system §10](design-system.md). Plain, short, no jargon.

## Required for every screen

- Works in light and dark.
- Works at 400px wide with no horizontal scroll. Mobile keeps chat, outputs and their details only (PRD A3).
- Colour never carries meaning alone. Verdicts show glyph and word.
- Visible focus, real buttons, labelled dialogs.
- Motion respects `prefers-reduced-motion` ([design-system §8](design-system.md)).

## Layout of `apps/web/src`

| Path | Holds |
|---|---|
| `app/` | Routes, layouts, `globals.css` (tokens) |
| `app/(auth)/` | Sign in, create account, forgot password, email code, verify and reset pages with their shared card and form hook |
| `app/(marketing)/`, `app/_marketing/` | The public marketing pages and their shared pieces (header, footer, app frame) |
| `app/_workspace/` | Screen pieces shared by the signed in app and the public share link: charts, chat, output tabs |
| `lib/api/` | One file per resource: fetchers and mutation helpers, see [data.md](data.md) |
| `lib/demo/` | The demo backend that stands in for project, thread and output endpoints, see [data.md](data.md#demo-backend-until-the-api-serves-projects) |
| `lib/routes.ts` | Paths for the overview, project lists and projects. Build links with these, not by hand |
| `lib/` | Other small helpers |
| `e2e/` (in `apps/web`) | Playwright tests |

Shared components belong in `packages/ui`, not here. Only page-specific pieces stay in `apps/web`.

## Commands

`pnpm --filter @oraqul/web dev`, `build`, `typecheck`, `test:e2e`. See [testing.md](../testing.md).
