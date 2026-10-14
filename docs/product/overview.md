# Oraqul: Product Overview

## One liner

Oraqul is a verifiable AI agent for launch strategy in media and entertainment.

Oraqul builds, checks and repairs launch strategy. Plan a launch, audit the plan you already have, or rescue and relaunch one that missed, across films, series, music, books, podcasts and games. Each audience assumption is tested against real taste data from Qloo, so you see what holds and what breaks, with a receipt on every claim.

## What it is

Oraqul is a verifiable AI agent that builds, checks and repairs launch strategy in media and entertainment. Oraqul is an agent for the teams that launch cultural products. It does three jobs: it plans a launch, audits a launch plan, and rescues a launch that underperformed, which is a relaunch. There is one entry point. The user describes what they are launching, where, and what they already have, and the agent works out both the category and the job.

The agent works through several steps, shows its trace, and ends with a decision first summary and the evidence behind it. It gives direction, never forecasts.

## Who it is for

Launch and marketing teams in five categories. Each category is its own section of the product, with its own agent, inputs, charts and scenarios:

* Film and series: distributors, sales agents, studios and producers.
* Music: labels, managers and promoters.
* Books: publishers and publicists.
* Podcasts: networks and independent studios, meaning business teams, not solo hosts.
* Games: publishers and indie studios.

The problem is the same everywhere. Launch plans rest on audience assumptions that nobody writes down, borrowed from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong. Oraqul makes the assumptions explicit and checks each one.

## The three jobs

**Plan.** From a description, Oraqul builds a launch plan: the audience by age band and place, comparable titles, which territories or cities to prioritise, partner brands, and positioning angles. Each part is tested against Qloo before it is shown.

**Audit.** The user brings an existing plan. Oraqul pulls out the audience and taste assumptions it makes, tests each one, and marks it as holds, weak, breaks, or could not test. It then looks for stronger alternatives to whatever broke and tests those too.

**Rescue.** The launch is out and results are weak. The user adds actual results as aggregates, such as sales or streams by region, or age bands from a platform dashboard. Oraqul compares who actually showed up with who the plan assumed, finds which assumption was wrong, and builds a relaunch plan around the audience that is really there.

**Scenario testing** works inside all three. Change one assumption, such as an older opening audience or a different lead city, and Oraqul shows what changes, as a clear before and after.

## The five categories

All five run on one engine. Each has its own questions, output tabs, scenario presets and results format for rescue. A generic template handles anything else and says plainly that it is less certain.

* **Film and series distribution.** Audience by age and territory, comparable titles, partner brands, and overlap with rival titles the user names. Rescue takes opening results by territory.
* **Music releases and tours.** Support acts, tour cities, partner brands, and diaspora cities for African artists. Rescue takes streams and ticket sales by city.
* **Book publishing.** Comparable books, audience by age and place, adaptation and cross media angles, and retail or event partners. Rescue takes pre orders, sales by region and review aggregates.
* **Podcasts.** Audience and topic tags, sponsor brands, and guest fit. Rescue takes downloads by region and age band from the host dashboard.
* **Games.** Comparable games, fan bases to collaborate with across music and film, and which regions to prioritise. Rescue takes wishlists and player counts by region.

## How Oraqul uses Qloo, and what it adds

Qloo supplies the taste data: entity search, cross domain affinity across artists, films, series, books, podcasts, games, brands and places, tags, aggregate age and gender skews, location signals, trends over time, audience comparison and explainability.

Qloo does not supply everything Oraqul needs, so Oraqul has its own layer on top. Each signal is a published formula computed by code from values Qloo returned in the same run. The language model explains scores and never invents them.

* **Lift over a baseline.** Raw affinity follows popularity, so every city, segment or brand score is shown as lift over a neutral audience in the same place.
* **Single ranking call.** Scores from separate calls are not comparable, so rival overlap, city ranking and scenario diffs come from one call.
* **Derived signals.** Momentum, loyalty versus variety, partner fit, segment fit by age and gender split, rival overlap, and premium tolerance, which is a taste proxy and never a claim about willingness to pay.
* **Held back.** The values signal and the early adopter score stay out of the headline until they can be validated, and are labelled exploratory if shown.

New titles are not in Qloo yet, so Oraqul describes them as a bundle of comparable titles, tags and talent.

## What Oraqul does not do

* No box office, sales, stream, download or revenue forecasts.
* No pricing advice and no audience headcounts.
* No release calendars from Qloo. The user supplies their own dates and rival list.
* No social media metrics.
* No personal data is sent to Qloo. Only public entity names, city names and age bands go out. Uploaded results are aggregates with personal data removed.

The output is always a direction: holds, weak, breaks, or could not test.

## Trust and receipts

* Every line carries a verdict, a confidence level and a receipt showing the calls made, their parameters, the time, and the values used.
* Every entity the agent names must appear in data Qloo returned in that run.
* Gaps are stated plainly as not found, thin, or not supported, with what the agent did next and what input would change the answer.
* Each saved version records the date of its data and can be rerun with fresh data.
* Share links show receipt summaries. Raw Qloo data stays with signed in team members until Qloo confirms what may be shown publicly.

## How the agent behaves

* There is one category agent per category: Film and series, Music, Books, Podcasts and Games. A thin router reads the project's category and hands the project to that agent. The user never talks to the router.
* The five agents share one toolbox: the Qloo client, the verdict engine, the receipt writer and a red team step that did not see the plan being built. They differ in instructions, assumption checklist, scenarios and output schema.
* Category agents do not call each other freely. The one bounded exception is a book with a screen adaptation, where the Books agent can ask the Film agent one question and cite the answer as a receipt.
* The language model chooses its tools. Every Qloo call and every scoring function is a tool.
* It tries to find a better plan, not only score the one it was given.
* When an entity is ambiguous, it asks with a question card, for example whether the user means the artist or the documentary.
* It handles dead ends by searching alternatives and saying so.
* It stops when confident, or says what input would change the verdict.
* Follow ups rerun only what changed.
* The engine is also exposed as an MCP server so other agents can call it.

## Product structure

Media and entertainment is the one industry Oraqul serves today. Film and series, Music, Books, Podcasts and Games are its five categories. The hierarchy is Team, Category, Project, Job, Output.

* A team has members with owner, editor and viewer roles.
* A category is a section of the product, not a lane inside a project. A project belongs to exactly one category, because most people will not need several categories in one project. Each category's project list opens with what Oraqul tests there and the tools it has.
* Chat is the entry point, and the agent asks question cards instead of forms. The questions, quick actions and results format change with the category.
* A project holds several threads. Each thread chooses what it builds on: the current plan, another plan, or a fresh start.
* Every agent output ends with a summary and a takeaway card, then opens its own details page with only the tabs that fit it. Common tabs are Summary, Audience, Assumptions, Plan, Risks, Could not test and Evidence. Each category adds its own: territory ladder for film, tour route and support act grid for music, comp shelf and adaptation bridge for books, topic map for podcasts, fan base bridge and regions for games.
* Every line has a receipt. Charts have a table view.
* Versions can be compared. A one page brief exports with an evidence appendix and a confidence level per line.
* A read only share link can be turned off.
* The overview, the team's home after sign in, opens with three Start here cards: plan a launch, check a plan I have, rescue one that missed. Each says what you get and what you bring, and the project is made from the first message in the chat, never from an empty form.
* Every output tab opens with one plain sentence on what it shows, and output pages show four main tabs with the rest under More.
* Search on Ctrl K or Cmd K finds categories, projects, outputs and actions.
* Signed out visitors see sign in and an example answer. Live runs need an account, so the demo shows what the product really does.
* On mobile, only the core stays: chat, outputs and their details.

## How it looks and reads

Calm and clear, a little cinematic. Neutral surfaces, one dark ink for main actions, a quiet blue for focus, and colour only for verdicts and the small category icons. A characterful sans for titles and the bottom line, a clean sans for everything else, and soft fills instead of outlines. Light and dark are both designed. Motion is small and only marks things arriving: the agent's words appearing, the trace advancing, a view opening. Words are plain, and verdicts are always an icon, a word and a colour together. The design system file has the tokens, components and wording rules. The hosted prototype is the visual reference.

## Africa and diaspora

African titles and artists are treated as normal entities, and coverage will be tested first. For African releases, Oraqul ranks diaspora cities such as London, Houston and Toronto by lift beside African cities, and checks whether African city data is strong enough to rank. If it is not, the product says so plainly.

## What makes it different

* A receipt on every claim, with limits stated.
* Relaunch and scenario diffs, not only a first plan.
* One engine and one agent per category, so each category gets its own questions, charts and checks.
* Territory logic that includes diaspora cities.
* Honest gaps instead of confident guesses.

The demo leads with rescue and scenario diffs, because auditing a plan alone is no longer unique among entrants.

## Stack

TypeScript monorepo. Next.js front end. A Node backend on a VPS that calls the Qloo hackathon API directly through our own client. Vercel AI SDK with OpenAI. Postgres and Docker. A public repository with an open source licence for the submission.

## Open points

* Test Qloo's coverage first: Nigerian artists, titles and authors, Lagos against no location, and whether location changes the age and gender splits.
* Check Qloo's terms on showing receipts on public links.
* Confirm the monthly call quota, reported at about 10,000, and set a call budget per audit.
* Confirm Devpost's rules for a two person submission.
* The Qloo API details come from secondhand sources. Confirm them against Qloo's public docs repository and your own key.
