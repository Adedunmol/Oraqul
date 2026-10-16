# Git rules

## How we ship

Two people, one feature at a time, end to end. A feature is a vertical slice: shared types in `packages/schema`, the API endpoint or agent change, and the web screen that uses it, all in one branch and one PR. Most features ship with their screen. A backend-only PR is fine when the work has no screen yet (a runtime, a tool, an MCP server): the PR says why and names the screen that will use it.

- Build the screen from [frontend/design-system.md](frontend/design-system.md) and the components in `packages/ui`.
- Visual parity with the Claude artifact prototype is checked by hand by the two of you, outside this repo. Note in the PR what you checked it against.
- Whoever did not write the feature does that cross check.

## Branches

`type/short-name`, for example `feat/film-agent` or `fix/receipt-drawer`. Branch from `main`. Keep branches short lived and rebase on `main` before opening the PR.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.
- Scope is a package or app: `web`, `api`, `schema`, `engine`, `packs`, `ui`, `mcp`, `eval`, `docs`, or `repo` for root config. Leave it out when a commit really spans many.
- Summary: imperative, lower case, no full stop, under 72 characters.
- Body (optional): why, and anything a reviewer would not guess.
- Breaking change: `!` after the scope and a `BREAKING CHANGE:` line.
- One logical change per commit. No formatting sweeps mixed with behaviour changes.

```
feat(engine): add rival overlap band
fix(api): reject expired sessions
docs(agent): describe the red team step
```

## Pull requests

- Title follows the commit format. One feature per PR.
- Description: what changed, why, how to see it working, and what you compared against the prototype.
- Before every commit `pnpm test` passes, and before every push `pnpm check` passes. Git hooks in `.githooks` enforce both ([testing.md](testing.md#rules)).
- Before review: `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. UI changes checked in light and dark and at 400px wide. Comments you added say why, not what ([typescript.md](typescript.md#comments)).
- Product behaviour changes update `docs/product` in the same PR.
- Squash merge, with the PR title as the commit message.
