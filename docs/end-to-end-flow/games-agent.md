# Games agent: how it works end to end

A plain-language map of what the Games agent does from the first message to the saved output, what it can produce, and where it falls short of the docs. Product behaviour is in [product/spec.md](../product/spec.md); the technical map is [backend/games-overview.md](../backend/games-overview.md). It runs on the same runtime as the Film and Music agents, so the path of a message is the one in [film-agent.md](film-agent.md#the-path-of-a-message), with category `games`. Where this file and those disagree, they win.

Status: built on the shared launch runtime, and tested on demo data (unit specs, golden runs, and an end-to-end spec through the API). It has not been run against live Qloo.

## What it can do

| Job | Reply type | What it does |
|---|---|---|
| Build | plan | Turns a description into a launch plan: bottom line, positioning, audience, regions, and the sections that fit the launch kind (store page and tags, festivals and showcases, fan base collabs, creators and streamers, press and podcasts, brand partners, community, soft launch, early access roadmap, seasons and retention), then launch beats, budget split, what to measure and risks. The team's regions, platforms, kind, comparable games and collabs stay as chosen. |
| Audit | report | Tests each assumption in an existing plan: age, gender, each region, the comparable games, the platforms, the store tags, each named collab and creator, and partners. Output: assumptions grouped by verdict, risks, Worth a look, results against the plan when the game is out, and a fix for each weak or broken item. |
| Fix | report, then plan | Audits first, then writes a new plan. It asks whether the game is out, and for results by region if it is. |
| Answer | message only | A question about the plan, answered from its saved findings and checked like a plan line. |
| What-if | plan (`scenario`) | Reruns the plan with changed regions, comparable games, collabs, age or gender and shows what changed. |
| Rival date check | small brief | Scores rival games against the plan's audience on the dates given. |
| Partner brief | small brief | A drafted pitch to a brand or a podcast, scored against the plan's findings. Nothing is ever sent. |

## What is different from Film and Music

- **The launch kind decides the plan.** Premium, early access, free to play and mobile each get their own sections, calendar, measures and budget split. The agent never asks which: it plans a premium PC launch and says what it assumed.
- **The calendar is built by code from today.** Beats become dates when the release date is known, and a beat already over is never advised. Festival and sale dates appear only when a web source states them.
- **The fan base bridge.** The plan ranks the artists, series, anime, films, brands, podcasts and other games this audience follows, within each kind of media, and ranks a collab the team named beside them.
- **Platforms and store tags are tested.** The comparable games' platforms and tags, as Qloo lists them, are compared with the team's.
- **Regions, not only cities.** A region such as Europe is ranked through the cities that stand for it. With none named, the usual markets for the launch kind are ranked and said to be an assumption.
- **No venues, no tour.** The Music queries and the route score do not apply.

## Rules held in code

The same as Film's ([film-agent.md](film-agent.md#rules-held-in-code)): verdicts, scores and confidence come from Qloo values; a line that claims something about taste or place cites a finding; code checks every line; forecasts, pricing advice and sending are refused before any model or Qloo call; only public names and age bands go to Qloo; an audit or a fix never tells a team to drop a region, a comparable game, a collab or a platform it chose. A line that states a wishlist, install or player count needs a web source like any money figure.

## What it does not yet do

- **Live Qloo, mostly.** Game signals for each kind of media, regions, tags and `/entities` metadata are checked live ([qloo.md](../backend/qloo.md)). Still open there: an anime tag on a game signal, and the genre-only fallback, which returned unrelated games. The starting values for the platform and store tag verdicts are chosen conventions, tuned on demo data.
- **Creators and streamers.** The section is launch practice until Qloo is shown to return them.
- **Recorded live golden runs.** Games has demo goldens only.
- **The gaps Film has** ([film-agent.md](film-agent.md#what-the-docs-say-it-should-do-that-it-does-not-yet)): the results cards, and the missing engine tools.
- **The screens** are the shared ones (Plan tab, receipts drawer, exports) plus the Fan base bridge and Regions tabs. They have not been compared with the prototype.
