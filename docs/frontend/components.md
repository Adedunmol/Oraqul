# Components in code

How [design-system.md](design-system.md) becomes code. Do not repeat token values here, they live in the design system and in `apps/web/src/app/globals.css`.

## Tokens to Tailwind

`globals.css` defines the tokens on `:root` (light), in a guarded `prefers-color-scheme` block, and under `[data-theme="dark"]`. An `@theme inline` block maps them to Tailwind colours, so utilities read the tokens:

| Utility | Reads |
|---|---|
| `bg-bg`, `bg-surface`, `bg-surface2`, `bg-surface2-hover`, `bg-card`, `bg-card-hover` | `--bg`, `--surface`, `--surface2`, `--surface2-hover`, `--card`, `--card-hover` |
| `text-ink`, `text-muted`, `border-line` | `--ink`, `--muted`, `--line` |
| `bg-holds-bg text-holds` (and weak, breaks, cant) | verdict tokens |
| `text-cat`, `bg-cat` | `--cat`, set by `data-cat`. Icon tile and stroke only |
| `bg-good`, `bg-warn`, `bg-crit`, `bg-na`, `bg-s1`, `bg-s2` | chart and status tokens, for chart marks only |
| `font-display`, `font-sans`, `font-mono` | Bricolage Grotesque, Geist, Geist Mono |

Adding a token: add it in all three places in `globals.css`, then map it in `@theme inline`.

## `packages/ui`

- One component per file, named export, re-exported from `src/index.ts`.
- Components that show a verdict or confidence take the **data value** and draw the glyph and word themselves, so no screen can show colour alone. `VerdictPill` is the pattern.
- No literal colours. No category colour except on icon tiles.
- `apps/web/globals.css` has an `@source` line so Tailwind scans this package. Keep it if the folder moves.

## Inventory

From [spec §9.1](../product/spec.md). Tick as built.

- [x] VerdictPill
- [x] Button (`buttonClassName` for links that must look like one), Input, Select
- [x] Chip and ChipButton, Kbd
- [x] Card, Icon (projects, team, the five categories, search), Logo, PageHead
- [x] Confidence, ReceiptChip
- [x] Tabs (controlled), TabNote
- [~] Line, ReceiptDrawer, SummaryCard: in `apps/web/src/app/_workspace/output/` (they read the output context)
- [~] StartCard and the Start picker: `apps/web/src/app/_workspace/start-cards.tsx`, scenes in `start-art.tsx`. Message box with files: `_workspace/chat/composer.tsx`. ProjectCard: in `apps/web/src/app/_workspace/projects-screen.tsx`
- [~] QuestionCard, Trace: in `apps/web/src/app/_workspace/chat/`
- [~] Chart (with table toggle and `data-tip` hover text): `apps/web/src/app/_workspace/charts.tsx`
- [~] Palette in `(app)/_components/palette.tsx`, Toast in `_workspace/toast.tsx`
- [~] Modal: built in `apps/web/src/app/(app)/_components/modal.tsx` (native `dialog`). It moves to `packages/ui` once that package has a client entry.

Items marked `[~]` hold state or read a context, so they stay in `apps/web` until `packages/ui` has a client entry (see the Modal note).

## TODO

Icon set beyond projects and team, chart conventions. The theme toggle sets `data-theme` and saves it in `localStorage` (`oraqul-theme`); an inline script in the root layout applies it before first paint.
