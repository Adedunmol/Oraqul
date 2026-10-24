# Live shows: how it is built

What the Live shows agent changes relative to Music and Podcasts. Everything else, the pipeline, the line check, receipts and verdicts, is the shared launch runtime ([agent.md](agent.md)). Product behaviour is in [shows-agent](../product/shows-agent.md).

## Pack

`packages/packs/src/shows/`:

- `index.ts`: the `CategoryPack`.
- `catalog.ts`: `SHOWS_QUERIES` (`audience`, `markets` core; `similar`, `brands`, `podcasts`, `venues` by module), `TAG_SPACES`, and `SHOWS_VENUE_PLACES` by show type.
- `modules.ts`: the show types and their parser (`showTypeMatch`), `pickModules`, and the pure maths: `onSaleFor`, `onSaleDates`, `weeksLeft`, `isLastMinute`, `phasesFor`, `pacingFor`, `ticketTarget` and `beatsFor`. All of it is tested in `modules.test.ts`.
- The rules are in `packages/packs/src/rules/shows.ts` (`SHOWS_PLAN_RULES`, E1 to E8, and the `SHOWS_RULES` library for the signal and channels).

Schema: the module keys `onsale`, `finalpush` and `venues`, and the audit report's `ruleChecks`.

## API agent

`apps/api/src/agent/shows/`, the same file set as Music:

| File | What is its own |
|---|---|
| `read.ts` | The reading adds the act, show type, capacity, price band, on-sale weeks and rival dates. `labelled()` reads the Guide's labelled lines by form, so a model reader cannot lose them |
| `planner.ts` | Venue places by show type, a music scene only for concerts and club nights |
| `findings.ts` | `similar`, `brands`, `podcasts` and `venues` queries |
| `config.ts` | The code sections `onsale` and `finalpush` (via `codeSections.extra` and `codeKeys`), the budget by phase, the show calendar, the gaps, and `ruleChecks` for an audit |
| `writer.ts`, `report-writer.ts`, `research.ts` | Prompts and templates for a promoter's plan |

Shared code that changed for it:

- `launch/config.ts`: `codeKeys`, `codeSections.extra`, `clashByProximity`, `ruleChecks`, `calendarBeats`.
- `launch/direction.ts`: `showDateCalls`, a call per rival date set by its distance from the show and by Qloo's overlap where a rival was scored.
- `launch/audit.ts`: puts `ruleChecks` on the report.
- The router: a concert, a gig or a live show matches both Music and Live shows, so it asks which.

## Qloo

Anchors are artists, films and people. Rivals are scored as artists, so a comedian rival is not scored; the call is made from the date alone, at the lowest confidence. Venue categories: night club (all four test cities), concert hall (London, New York, thin in Lagos), comedy club and theater (London and New York only), movie theater (all four). Probe: `pnpm --filter @oraqul/engine qloo:shows-probes`.

## Tests

`pipeline.spec.ts`, `audit.spec.ts` (rule checks and reading the Guide's brief), `golden.spec.ts` with six cases in `packages/eval/golden/shows/`, `modules.test.ts` in the pack. The goldens run on demo data; no live Qloo run is recorded for Live shows.
