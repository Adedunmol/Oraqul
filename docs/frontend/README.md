# Frontend

Next.js App Router in `apps/web`. The look is defined in [design-system.md](design-system.md). Turning it into code is in [components.md](components.md). Routes and screens are in [spec §9](../product/spec.md).

> `apps/web/AGENTS.md` (written by Next) warns that this Next.js version has breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before using a Next API you have not used in this repo.

## Rules

- Server components by default. Add `"use client"` only for state, effects, browser APIs or event handlers, and keep those components small and low in the tree.
- The web app talks to the API only, through `src/lib/api.ts` (sends the session cookie). It never imports `engine` or `packs`.
- Types come from `@oraqul/schema`. Parse API responses with its schemas at the fetch boundary, see [typescript.md](../typescript.md).
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
| `lib/` | `api.ts` and other small client helpers |
| `e2e/` (in `apps/web`) | Playwright tests |

Shared components belong in `packages/ui`, not here. Only page-specific pieces stay in `apps/web`.

## Commands

`pnpm --filter @oraqul/web dev`, `build`, `typecheck`, `test:e2e`. See [testing.md](../testing.md).
