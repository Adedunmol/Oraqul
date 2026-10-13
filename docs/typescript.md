# TypeScript

Adapted from [this gist](https://gist.github.com/pipethedev/ff13d98a5b626f985708afb343723048). Read it when you want the original wording.

## Core rule

Validate untrusted data once, at the boundary. Trust typed code everywhere else.

Boundaries in this repo: HTTP bodies and params, env vars, Qloo responses, model output, uploaded files, raw `jsonb` from Postgres. Use the Zod schemas in `packages/schema` (or the API's own) at these points and nowhere else.

## Types

- No `any`. Avoid `unknown` and `Record<string, unknown>` in application code. Fix the broad type where it comes from.
- Do not end "validation" in an unsafe cast. Either parse with a schema or trust the type.
- Do not add runtime checks around a cast the external contract already guarantees.
- Use discriminated unions for exclusive states and events (see `threadEventSchema`).
- Do not widen function inputs "for flexibility". Do not coerce with `String()`, `Number()` or `Boolean()`.
- Fields are optional only when the business meaning requires it.

## Helpers and abstractions

- Be suspicious of `asX`, `safeX`, `normalizeX` and similar helpers that paper over weak upstream types.
- Delete one-use helpers, pass-through wrappers, mappers between identical types, and static-only classes.
- No generics, builders, factories or interfaces until a second real use exists.
- No `utils`, `helpers` or `common` folders. Name files for what they do.

## Fallbacks and checks

- Do not hide invalid state behind `?? ""`, `|| {}` or `return undefined`. If a value is required, throw.
- Use `?.`, `typeof` and `instanceof` only for values that are really optional or untrusted.
- Keep real defensive code: Qloo failures, not-found rows, nullable columns, malformed input, JSON parse failures, authorization.

## Errors and logging

- Do not swallow errors. Do not catch and rethrow without adding something.
- Do not wrap errors at every layer. Handle them where something can be done about them.
- Do not log and rethrow. Do not log every internal step.

## Style

- Early returns. Simple `if` and `switch`. No nested ternaries.
- Comments explain why, not what.
- No needless `async`, Promise wrappers, spreads or callbacks.

## Repo specifics

- TypeScript is pinned to 5.9 by a pnpm override in `pnpm-workspace.yaml`, because TypeScript 7 breaks tsup's `.d.ts` build. Revisit when tsup supports it. `strict` and `noUncheckedIndexedAccess` are on in `tsconfig.base.json`.
- Biome formats and lints. Run `pnpm format` before committing.
- `apps/api` is ESM: relative imports end in `.js`.
- Category, job and role lists are `as const` tuples in `packages/schema` so Zod and Drizzle share one source.

## Before and after an edit

Before: find the trust boundary and fix the root type. After: check that every helper, cast, branch and fallback you added is needed. Delete the ones that are not.
