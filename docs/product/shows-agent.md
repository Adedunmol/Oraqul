# Live shows agent

A single show or a short run: a concert, a comedy night, a club night, a stage play, or a one night premiere or screening. Not festivals, full tours, routing, venue logistics or booking a lineup. The category id is `shows`.

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

Each is a default the team can edit, with its source in the [rule library](launch-rules.md). The comedy figures come from a 2019 Eventbrite article. The 57 percent figure is secondhand: the ticketing blog behind it (TickPick) attributes it to Eventbrite. No Nigerian live event data was found, so none of it is specific to Nigeria. Email and SMS are playbook lines, not platforms.

| | Rule | Enforced in |
|---|---|---|
| E1 | Work backwards from the show date. General on sale opens about 4 to 6 weeks out for a comedy night, 6 to 10 for an independent concert and 2 to 4 for a club night. Theatre and screenings were not researched, so the team supplies the window and the plan marks it as user supplied | `onsale` section (`shows/config.ts`), `onSaleFor` |
| E2 | One primary signal: tickets sold against capacity, as sell-through at checkpoints. Presale registrations, followers and views are secondary. The target is the team's. The default pacing is back loaded: about 6 percent of a comedy night sells in the first week and 75 in the last; across events about 57 percent sell in the final week | `pacingFor`, `ticketTarget`; the signal rule |
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
