# Live shows

A single show or a short run: a concert, a comedy night, a club night, a stage play, or a one night premiere or screening. Not festivals, full tours, routing, venue logistics or booking a lineup. The category id is `shows`.


Shared rules are in [principles.md](../product/principles.md); the runtime is in [launch-runtime.md](../backend/launch-runtime.md). What Live shows changes relative to Music and Podcasts is below.

## What the team supplies

Qloo holds no ticket prices, venue capacity or event calendars, so the team supplies them, and a plan shows "not available" where one is missing. Nothing is invented.

| Input | How it is read |
|---|---|
| Show type | `Show type:` line, or the words in the brief (stand-up, club night, stage play, screening, concert, gig). With nothing said the plan assumes a concert and says so |
| Show date | The date in the brief. Rival lines are left out when reading it |
| City | The cities named, home first. One plan per city |
| Venue capacity | `Venue capacity: 500` |
| Ticket price band | `Ticket price band: under $30`. Never estimated |
| On-sale weeks | `On sale: 6 weeks before the show`. Needed for theatre and screenings |
| Budget band | Asked first, as in every category |
| Rival show dates | `Rivals: Title on YYYY-MM-DD` |
| Target | `target 80 percent` (of capacity) or `target 400 tickets`. Only the team sets it |

## What Qloo is used for

Taste fit of the act, similar acts by city, the venues and places the audience goes out to, audience overlap with rival shows, and brand fit for sponsors. Concert acts resolve as artists and comedians as people; a stage play resolves only as a film or a cast album, so a theatre read is thin. Venue lists are good in London and New York and thin or empty in Lagos and Accra for comedy clubs, theatres and concert halls ([qloo.md](../backend/qloo.md)).

## The live show rules

Each is a default the team can edit, with its source in the [rule library](../product/launch-rules.md). The comedy figures come from a 2019 Eventbrite article. The 57 percent figure is secondhand: the ticketing blog behind it (TickPick) attributes it to Eventbrite. No Nigerian live event data was found, so none of it is specific to Nigeria. Email and SMS are playbook lines, not platforms.

| | Rule | Enforced in |
|---|---|---|
| E1 | Work backwards from the show date. General on sale opens about 4 to 6 weeks out for a comedy night, 6 to 10 for an independent concert and 2 to 4 for a club night. Theatre and screenings were not researched, so the team supplies the window and the plan marks it as user supplied. A window the team gives for a comedy night, concert or club night is said to be inside or outside the rule, and a fix replaces one outside it with the rule's default | `onsale` section (`shows/config.ts`), `onSaleFor` |
| E2 | One primary signal: tickets sold against capacity, as sell-through at checkpoints. Presale registrations, followers and views are secondary. The target is the team's. The default pacing is back loaded: about 6 percent of a comedy night sells in the first week and 75 in the last; across events about 57 percent sell in the final week. The plan shows each checkpoint as a percent of the team's target, labelled directional with its source, and never as other ticket counts | `pacingFor`, `ticketTarget`; the signal rule |
| E3 | A presale opens 3 to 7 days before general on sale behind an access code, with registration open 4 to 7 days. The first 48 hours of general on sale matter most. Never a presale with no end date | `onsale` section |
| E4 | Budget by phase: 40 announce and on sale, 20 middle, 40 final push. Comedy and last-minute shows: 50, 10, 40. The final push is always held back | `budget` section, `phasesFor` |
| E5 | The final push by intent: people who clicked a purchase link and did not buy, then people who opened or clicked earlier messages, registered or entered a giveaway, then the core audience. Ticket holders get show information, not sales messages | `finalpush` section |
| E6 | Rival shows on the same night or in the same week are flagged okay, risky or avoid, from the rival date and Qloo's audience overlap. Direction only | `showDateCalls` in `direction.ts` |
| E7 | One plan per city, home first. The budget band is asked first, and the plan proposes only what it can carry | the territories and the band card |
| E8 | Guides and scripts only: announcement copy, presale email and SMS scripts, ad hook options, a promo calendar and shot lists. Never ads, images or video | the refusal, `ASSET_OFFER`, the creative kit |

A last-minute show has fewer weeks left than the shortest on-sale window for its type. All pacing, dates and splits are computed by code from the team's inputs; the model writes none of them.

## Audit and fix

An audit tests the beliefs Qloo can test (age, cities, comparable acts, sponsors, support acts) and sets the plan's own dates and shares beside the rules. These rule checks are not Qloo verdicts and have no confidence: each is `follows`, `outside`, `not stated`, or `no rule` (theatre and screenings).

- The on-sale window against E1.
- The presale against E3: 3 to 7 days ahead, and an end date.
- The final push reserve against E4.
- Rival dates against E6.

## Out of scope

Festivals, full tours and routing, venue logistics and lineup booking. Ticket sales forecasts. Ticket pricing advice.

## How it works in code

### Pack

`packages/packs/src/shows/`:

- `index.ts`: the `CategoryPack`.
- `catalog.ts`: `SHOWS_QUERIES` (`audience`, `markets` core; `similar`, `brands`, `podcasts`, `venues` by module), `TAG_SPACES`, and `SHOWS_VENUE_PLACES` by show type.
- `modules.ts`: the show types and their parser (`showTypeMatch`), `pickModules`, and the pure maths: `onSaleFor`, `onSaleDates`, `weeksLeft`, `isLastMinute`, `phasesFor`, `pacingFor`, `ticketTarget` and `beatsFor`. All of it is tested in `modules.test.ts`.
- The rules are in `packages/packs/src/rules/shows.ts` (`SHOWS_PLAN_RULES`, E1 to E8, and the `SHOWS_RULES` library for the signal and channels).

Schema: the module keys `onsale`, `finalpush` and `venues`, and the audit report's `ruleChecks`.

### API agent

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

### Qloo

Anchors are artists, films and people. Rivals are scored as artists, so a comedian rival is not scored; the call is made from the date alone, at the lowest confidence. Venue categories: night club (all four test cities), concert hall (London, New York, thin in Lagos), comedy club and theater (London and New York only), movie theater (all four). Probe: `pnpm --filter @oraqul/engine qloo:shows-probes`.

### Tests

`pipeline.spec.ts`, `audit.spec.ts` (rule checks and reading the Guide's brief), `golden.spec.ts` with six cases in `packages/eval/golden/shows/`, `modules.test.ts` in the pack. The goldens run on demo data; no live Qloo run is recorded for Live shows.

## Limits

- Qloo holds no ticket price, capacity or calendar data, so the team supplies them.
- Qloo scores artists only, so a comedian or play as a rival is called from its date alone.
- Theatre and screening on-sale windows were not researched.
- No live Qloo run is recorded for the goldens.
