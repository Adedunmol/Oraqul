# Music agent: how it works end to end

A plain-language map of what the Music agent does from the first message to the saved output, what it can produce, and where it falls short of the docs. Product behaviour is in [product/spec.md](../product/spec.md); the technical map is [backend/music-overview.md](../backend/music-overview.md). It runs on the same runtime as the Film agent, so the path of a message is the one in [film-agent.md](film-agent.md#the-path-of-a-message), with category `music`. Where this file and those disagree, they win.

Status: built on the shared launch runtime, and tested on demo data (unit specs, golden runs, and an end-to-end spec through the API). It has not been run against live Qloo.

## What it can do

| Job | Reply type | What it does |
|---|---|---|
| Build | plan | Turns a description into a launch plan: bottom line, positioning, audience, cities, and the modules that fit the ask (partnerships, press and playlists, community, tour route, support acts, sync, timeline, budget, measures, risks). The team's cities, their order and their sound-alikes stay as chosen. |
| Audit | report | Tests each assumption in an existing plan: age, gender, each city, the sound-alikes, the tour order, partners and each support act. Output: assumptions grouped by verdict, risks, Worth a look, results against the plan when the release is out, and a fix for each weak or broken item. |
| Fix | report, then plan | Audits first, then writes a new plan. It asks whether the release is out, and for results by city if it is. |
| Answer | message only | A question about the plan, answered from its saved findings and checked like a plan line. |
| What-if | plan (`scenario`) | Reruns the plan with changed cities, sound-alikes, age or gender and shows what changed. |
| Rival date check | small brief | Scores rival artists against the plan's audience on the dates given. |
| Partner brief | small brief | A drafted pitch to a brand, a podcast or a support act, scored against the plan's findings. Nothing is ever sent. |

## What is different from Film

- **The artist is an anchor.** When Qloo knows the artist by name, it leads the audience question. It is never listed as a comp. A debut Qloo does not know is planned from the sound-alikes, and Gaps and the Assumptions tab say so.
- **The tour order is tested.** The team's order is scored against the strongest order. A weaker order keeps its place, with the stronger one offered beside it.
- **Support acts and sync.** The plan names the artists each city's audience plays, as support, and the series and films it watches, as sync targets.
- **No cinemas, no themes, no venues.** The Film queries that make no sense for a record are not asked, and the Qloo place category for music venues is not verified.

## Rules held in code

The same as Film's ([film-agent.md](film-agent.md#rules-held-in-code)): verdicts, scores and confidence come from Qloo values; a line that claims something about taste or place cites a finding; code checks every line; forecasts, pricing advice and sending are refused before any model or Qloo call; only public names and age bands go to Qloo; an audit or a fix never tells a team to drop a city, a sound-alike or a support act it chose.

## What it does not yet do

- **Live Qloo.** The artist-as-signal queries (support acts, series, films, brands, podcasts, universities), the genre fallback for a debut, and the starting values for the tour order verdict are `TODO(verify)` in [qloo.md](../backend/qloo.md) and the spec. Run `pnpm --filter @oraqul/engine qloo:music-probes` with a key, then fix the docs and the code to match.
- **Recorded live golden runs.** Music has demo goldens only.
- **The gaps Film has** ([film-agent.md](film-agent.md#what-the-docs-say-it-should-do-that-it-does-not-yet)): the red team step, memory, next-step suggestions, share links, the results cards, and the missing engine tools.
- **The screens** are the shared ones (Plan tab, receipts drawer, exports). The Music sections render with the same components as Film's, and they have not been compared with the prototype.
