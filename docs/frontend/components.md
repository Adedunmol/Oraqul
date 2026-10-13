# Components in code

How [design-system.md](design-system.md) becomes code. Do not repeat token values here, they live in the design system and in `apps/web/src/app/globals.css`.

## Tokens to Tailwind

`globals.css` defines the tokens on `:root` (light), in a guarded `prefers-color-scheme` block, and under `[data-theme="dark"]`. An `@theme inline` block maps them to Tailwind colours, so utilities read the tokens:

| Utility | Reads |
|---|---|
| `bg-bg`, `bg-surface`, `bg-surface2` | `--bg`, `--surface`, `--surface2` |
| `text-ink`, `text-muted`, `border-line` | `--ink`, `--muted`, `--line` |
| `bg-holds-bg text-holds` (and weak, breaks, cant) | verdict tokens |
| `text-cat`, `bg-cat` | `--cat`, set by `data-cat`. Icon tile and stroke only |
| `font-display`, `font-sans`, `font-mono` | Fraunces, Geist, Geist Mono |

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
- [ ] Chip, Line
- [x] Card, Icon (projects, team), Logo, PageHead
- [ ] Confidence, ReceiptChip, ReceiptDrawer
- [ ] Tabs, TabNote
- [ ] StartCard, ProjectCard, SummaryCard
- [ ] QuestionCard, Trace
- [ ] Chart (with table toggle)
- [ ] Palette, Toast
- [~] Modal: built in `apps/web/src/app/(app)/_components/modal.tsx` (native `dialog`). It moves to `packages/ui` once that package has a client entry.

## TODO

Icon set beyond projects and team, chart conventions. The theme toggle sets `data-theme` and saves it in `localStorage` (`oraqul-theme`); an inline script in the root layout applies it before first paint.
