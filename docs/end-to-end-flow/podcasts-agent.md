# Podcasts agent: how it works end to end

A plain-language map of what the Podcasts agent does from the first message to the saved output, what it can produce, and where it falls short of the docs. Product behaviour is in [product/spec.md](../product/spec.md); the technical map is [backend/podcasts-overview.md](../backend/podcasts-overview.md). It runs on the same runtime as the Film, Music and Games agents, so the path of a message is the one in [film-agent.md](film-agent.md#the-path-of-a-message), with category `podcasts`. Where this file and those disagree, they win.

Status: built on the shared launch runtime, and tested on demo data (unit specs, golden runs, and an end-to-end spec through the API). It has not been run against live Qloo.

## What it can do

| Job | Reply type | What it does |
|---|---|---|
| Build | plan | Turns a description into a launch plan: bottom line, positioning, audience, markets, and the sections that fit the launch kind and format (cross promotion shows, guests, sponsors, press and newsletters, video and clips, live shows, community, episode cadence), then launch beats, budget split, what to measure and risks. The team's markets, platforms, kind, format, comparable shows, topics and swaps stay as chosen. |
| Audit | report | Tests each assumption in an existing plan: age, gender, each market, the comparable shows, each topic the plan wants to own, each swap and sponsor. Output: assumptions grouped by verdict, risks, Worth a look, results against the plan when the show is out, and a fix for each weak or broken item. |
| Fix | report, then plan | Audits first, then writes a new plan. It asks whether the show is out, and for results by market if it is. |
| Answer | message only | A question about the plan, answered from its saved findings and checked like a plan line. |
| What-if | plan (`scenario`) | Reruns the plan with changed markets, comparable shows, swaps, age or gender and shows what changed. |
| Rival date check | small brief | Scores rival shows against the plan's audience on the dates given. |
| Partner brief | small brief | A drafted pitch to a sponsor or a show, scored against the plan's findings. Nothing is ever sent. |

## What is different from Film, Music and Games

- **The launch kind and the format decide the plan.** A new show and a new season get their own sections, calendar, measures and budget split, and video and guests appear only when they apply. The agent never asks which: it plans a new show in audio and says what it assumed.
- **The calendar is built by code from today.** Beats become dates when the release date is known, and a beat already over is never advised. Editorial windows and rival releases appear only when a web source states them.
- **The topic map.** One comparison of the show's audience with the audience of rival shows says which topics are the show's own and which both carry. The topics the team named are tested against it.
- **Cross promotion.** The plan ranks the shows the audience already hears, with a swap the team named scored in the same call.
- **Markets, not only cities.** A region such as West Africa is ranked through the cities that stand for it. With none named, the usual markets are ranked and said to be an assumption.
- **No venues, no tour.** The Music queries and the route score do not apply.

## Rules held in code

The same as Film's ([film-agent.md](film-agent.md#rules-held-in-code)): verdicts, scores and confidence come from Qloo values; a line that claims something about taste or place cites a finding; code checks every line; forecasts, pricing advice and sending are refused before any model or Qloo call; only public names and age bands go to Qloo; an audit or a fix never tells a team to drop a market, a comparable show, a topic, a swap or a sponsor it chose. A line that states a download, listener or follower count needs a web source like any money figure.

## What it does not yet do

- **Live Qloo, partly.** The queries were run live on one true crime brief (2026-10-20): audience, markets, topics, cross promotion, brands and the topic map all returned data (21 Qloo calls for a plan). Other subjects and markets are not probed one by one (see [qloo.md](../backend/qloo.md)), and Lagos and Johannesburg are too thin to rank. Run `pnpm --filter @oraqul/engine qloo:podcasts-probes` after any change to the queries.
- **Guests, and the artists and series a show's audience follows.** Qloo returns lists, but with no subject context they drift, so Guests is launch practice and the crossover query is off.
- **Recorded live golden runs.** Podcasts has demo goldens only.
- **The gaps Film has** ([film-agent.md](film-agent.md#what-the-docs-say-it-should-do-that-it-does-not-yet)): the results cards, and the missing engine tools.
- **The screens** are the shared ones (Plan tab, receipts drawer, exports) plus the Topic map, Cross promotion and Markets tabs. They have not been compared with the prototype.
