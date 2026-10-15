# Components in code

How [design-system.md](design-system.md) becomes code. Do not repeat token values here, they live in the design system and in `apps/web/src/app/globals.css`.

## Tokens to Tailwind

`globals.css` defines the tokens on `:root` (light), in a guarded `prefers-color-scheme` block, and under `[data-theme="dark"]`. An `@theme inline` block maps them to Tailwind colours, so utilities read the tokens:

| Utility | Reads |
|---|---|
| `bg-bg`, `bg-canvas`, `bg-surface`, `bg-surface2`, `bg-surface2-hover`, `bg-card`, `bg-card-hover` | `--bg`, `--canvas`, `--surface`, `--surface2`, `--surface2-hover`, `--card`, `--card-hover`. `bg-card` also gets the `--elev-1` lift (no outline), set once in `globals.css` |
| `bg-inset` | `--inset`: a panel inside a `bg-card`, never `bg-surface` (white on white in light) |
| `bg-button`, `bg-button-hover` | `--button`, `--button-hover`: default buttons and chips, solid with no outline |
| `bg-primary`, `bg-primary-hover`, `text-primary-ink` | `--primary`, `--primary-hover`, `--primary-ink`: solid primary buttons |
| `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-primary` | `--elev-1`, `--elev-1`, `--elev-2`, `--shadow`, `--elev-primary` (the primary button's lift) |
| `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl` | 6, 8, 10, 12px: the scale is remapped in `@theme`, so no pixel radii in components |
| `text-ink`, `text-muted`, `border-line` | `--ink`, `--muted`, `--line` |
| `bg-holds-bg text-holds` (and weak, breaks, cant) | verdict tokens |
| `text-cat`, `bg-cat`, `.cat-card` | `--cat`, set by `data-cat`. Icon tiles and strokes, and `.cat-card` (in `globals.css`), the project card tint |
| `bg-good`, `bg-warn`, `bg-crit`, `bg-na`, `bg-s1`, `bg-s2` | chart and status tokens, for chart marks only |
| `font-display`, `font-sans`, `font-mono` | Space Grotesk, Geist, Geist Mono |

Adding a token: add it in all three places in `globals.css`, then map it in `@theme inline`.

## `packages/ui`

- One component per file, named export, re-exported from `src/index.ts`.
- Components that show a verdict or confidence take the **data value** and draw the glyph and word themselves, so no screen can show colour alone. `VerdictPill` is the pattern.
- No literal colours. Category colour only on icon tiles and strokes, and on project cards through `.cat-card`.
- `apps/web/globals.css` has an `@source` line so Tailwind scans this package. Keep it if the folder moves.

## Inventory

From [spec §9.1](../product/spec.md). Tick as built.

- [x] VerdictPill
- [x] Button (`buttonClassName` for links that must look like one), Input
- [x] Chip and ChipButton, Kbd
- [x] Card, Icon (Lucide behind our own names, see design-system §7.20), Logo, PageHead
- [x] Confidence, ReceiptChip
- [x] Tabs (controlled), TabNote
- [~] Line, ReceiptDrawer, SummaryCard: in `apps/web/src/app/_workspace/output/` (they read the output context)
- [~] StartComposer, the start message box with its three hints: `apps/web/src/app/_workspace/start-composer.tsx`. Message box with files: `_workspace/chat/composer.tsx`, used by every chat. ProjectCard and the category filter: in `apps/web/src/app/_workspace/projects-screen.tsx`. The project workspace: `app/(app)/categories/[category]/projects/[id]/project-screen.tsx`, also rendered by `/threads/:id`
- [~] QuestionCard, Trace: in `apps/web/src/app/_workspace/chat/`
- [~] Chart (with table toggle and `data-tip` hover text): `apps/web/src/app/_workspace/charts.tsx`
- [~] Palette in `(app)/_components/palette.tsx`, Toast in `_workspace/toast.tsx`
- [~] Dropdown and SearchDropdown: `apps/web/src/app/_components/dropdown.tsx`. Our own select, never the browser's `<select>`. Same client-entry reason as Modal
- [~] Modal: built in `apps/web/src/app/(app)/_components/modal.tsx` (native `dialog`). It moves to `packages/ui` once that package has a client entry.

Items marked `[~]` hold state or read a context, so they stay in `apps/web` until `packages/ui` has a client entry (see the Modal note).

## TODO

Chart conventions. The theme toggle sets `data-theme` and saves it in `localStorage` (`oraqul-theme`); an inline script in the root layout applies it before first paint.
