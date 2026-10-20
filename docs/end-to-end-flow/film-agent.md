# Film agent: how it works end to end

A plain-language map of what the Film agent does from the first message to the saved output, what it can produce, and where it falls short of the docs. Product behaviour is in [product/spec.md](../product/spec.md); the step-by-step build map is in [backend/film-overview.md](../backend/film-overview.md). Where this file and those disagree, they win.

Film runs on the shared launch runtime in `apps/api/src/agent/launch/`. Film, Music and Games have real agents ([music-agent.md](music-agent.md), [games-agent.md](games-agent.md)). Books and Podcasts are placeholders.

## The path of a message

1. **Router.** The first message goes to the router, which reads the title, the category (film) and the mode (build, audit or fix). A value counts only when the model's quote is found in the person's own words. If something is unclear it asks one card; an off-topic message gets a fixed refusal. A mode chosen on the start page with Check my plan or Fix my plan is kept even when the plan's own words say "launch" and "release".
2. **Gate.** Every later message in a project is checked first: on topic, off topic (fixed refusal) or unclear (a card).
3. **Film agent.** With no plan in the chat, it does the job the project started with: build, audit or fix, unless the message plainly asks for an audit or a fix ("audit this plan", "fix my plan"), in which case that job runs, so a new chat in a build project can audit an attached plan. With a plan or report already in the chat, the message is a follow-up and code picks the job.
4. **Fixed pipeline.** Each job runs fixed steps in code, and each step shows in the chat as a trace line. The steps are: read the input, find the comparable titles in Qloo, choose the queries, ask Qloo, optionally look up the market on the web, then test or write, then check every line. Findings stream into the chat as Qloo answers.
5. **Save and show.** The run saves its outputs and receipts in one transaction. The web shows the message, an output card, and tabs with a receipt drawer behind every line.

## What it can do

| Job | Reply type | What it does |
|---|---|---|
| Build | plan | Turns a description into a launch plan: bottom line, positioning, audience, markets, and the modules that fit the ask (partnerships, placement, publicity, community, route, timeline, cadence, budget, measures, risks). The team's cities and comps stay as chosen. |
| Audit | report | Tests each assumption in an existing plan. Output: assumptions grouped by verdict, risks, Worth a look, results against the plan when the launch is out, and a fix for each weak or broken item. |
| Fix | report, then plan | Audits first, then writes a new plan. It asks whether the launch is out, and for results by city if it is. |
| Answer | message only | A question about the plan, answered from its saved findings and checked like a plan line. |
| What-if | plan (`scenario`) | Reruns the plan with changed cities, comps, age or gender and shows what changed. |
| Rival date check | small brief | Scores rival releases against the plan's audience. |
| Partner brief | small brief | A drafted pitch scored against the plan's findings. Nothing is ever sent. |

## Rules held in code

- Verdicts, scores and confidence come from Qloo values, never from the model.
- A line that claims something about taste, audience or place cites a finding. Launch practice is labelled playbook and cites nothing.
- Code checks every line and drops failures, logging them in `dropped`.
- Forecasts, pricing advice and sending are refused with fixed words before any model or Qloo call.
- Only public entity names, place names and age bands go to Qloo. Results the person adds are aggregates and never leave the API.
- Nothing in an audit or fix tells a team to drop a city, a comp or a partner it chose. A fix reorders them or adds a stronger option beside them.
- With no model key, scripted readers and template writers still produce a complete run.

## Output kinds

- **Plan** (`build`, `scenario`, `fix`): a launch plan with findings, receipts and the brief behind it.
- **Report** (`audit`): an audit report. A fix saves the report first and then the plan, whose parent is the report. A fixed plan carries the report it answers, for its "What was fixed" tab.
- **Small briefs** (`date`, `partner`): saved outputs on a plan.
- **Answer**: a message in the chat with cited claims and no saved output.
- All outputs export to Markdown, Word and PDF, with grounded lines footnoted to findings. A project keeps versions that can be compared. PDF and Word files can be uploaded as input.

## What the docs say it should do that it does not yet

### Not built for Film

- **Memory** (spec §3.7): team and project memory, and summaries of long chats. The agent uses only the current plan and the last 8 chat lines.
- **Next-step suggestions after each output.** The web passes none to the chat. The only suggested step is the Fix this plan button on a report.
- **Missing engine tools:** `crossTaste`, `tagWeights`, `momentum`, `explain`, `applyScenario` and `compareResults`. Rerunning only what changed in a what-if (spec §3.5) is still a `TODO`, so a what-if reruns every query.
- **Results cards.** The docs describe split, confirm and date cards for entering results. Results come in through a text card, parsed from lines like "Lagos: 4,200", or by the model reader. There is no form or file column mapping.
- **Dropped-line visibility.** Lines the check drops are stored but not shown anywhere in the product.

### Not verified against real Qloo

- `backend/qloo.md` still has `TODO(verify)` items, and the live smoke run has not been run with a key.
- Contract tests against recorded responses are "not started" in [testing.md](../testing.md).
- The cut-offs for partner and artist verdicts and for results gaps (spec §5.3) are starting values and need a live run.

### Only Film, Music and Games exist

- Books and Podcasts say they are not connected. The Books to Film consult exists only in the generic tool loop, which no other agent uses yet.

### Gaps in audit and fix

- The scripted reader takes a partner only when a capitalised name sits next to "partner" or "sponsor" ("with Nike as a partner", "sponsored by MTN"), so without a model key other phrasings are not tested. A lone partner with no other brand candidates shows as "could not test".
- Window, budget and forecasts are always "could not test". Cast, director and media or podcast placements are not extracted as claims.
- Auditing an Oraqul plan reads it back as exported Markdown, which works but is rough.
- Audit and fix have only run on demo data, so the wording a model writes for risks and alternatives is untested.
- The new report screen was built from the design system and has not been compared with the prototype.
