# Oraqul: Product Overview

## One liner

Launch plans grounded in what audiences actually like.

Oraqul is a culturally grounded launch agent for the teams that launch films, series, music, books, podcasts, games and live shows. It is built to stop launches failing and to make them pay: it builds a plan, audits one the team already has, fixes weak decisions, and, once the launch is out, reads the results the team supplies and revises the plan around them. Its cultural claims (which artists, series, cinemas, brands and communities the audience likes, in which cities) are measured in Qloo taste data, so a plan says which of its claims are measured, which are sourced and which are launch craft.

## What it is

Oraqul is an agent for the teams, and the people on them, that launch cultural products in media and entertainment. It does three jobs: it plans a launch, audits a launch plan, and fixes one, before the launch or after it. After the launch the same loop carries on: the team supplies results, Oraqul compares them with the plan and writes a revised plan. The journey is research, plan, campaign, then revision from results. A plan with a content calendar can be set up as a campaign: its calendar as actions the team runs, edits and ticks off inside the project, each with a guide to adapt, and optionally a two-angle test. A revised plan gets its own set of actions and the earlier set is left as it was. The team can add its own results for a test, and Oraqul compares them in code and says inconclusive when the figures are thin or close. A saved plan can also be checked for what has changed since it was made, and the plan stays as it is until the team asks for a revision. Once the plan exists Oraqul keeps working on it: a launch watch re-checks it on a schedule for rivals that land near its date, campaign dates that slip and a plan that has grown old, and tells the team's owners and editors. The team can enter its own figures against the plan's one signal and Oraqul says whether the launch is ahead of, on or behind the plan's pace, and when it is behind, a rescue names where to put the next seven days. Anything that leaves Oraqul goes out only after a person approves it. For a full plan it also finds sponsors (the brands Qloo ranks for each territory, with a sponsorship a page confirms) and funds that are open now (each with its source, the day it was read and an eligibility worked out in code), keeps a pipeline for each, and drafts the pitch or application for the person to send from their own app. A team's owners can set defaults once, such as a budget ceiling or banned partners, and every plan follows them. Other agents can plan through Oraqul over a hosted MCP server with a personal token, and read the result as a summary. There is one entry point. The user describes what they are launching, where, and what they already have, and the agent works out both the category and the job.

Every reply has two stages. First, findings: the model reads the brief and shapes the questions, code asks Qloo and turns each answer into a sentence, and the findings stream into the chat while they land. Then the reply: the model writes the plan from the findings and its launch knowledge, and code checks every line. It gives direction, never forecasts.

## Who it is for

Launch and marketing teams in six categories. Each category is its own section of the product, with its own agent, inputs, charts and scenarios:

* Film and series: distributors, sales agents, studios and producers.
* Music: labels, managers and promoters.
* Books: publishers and publicists.
* Podcasts: networks and independent studios, meaning business teams, not solo hosts.
* Games: publishers and indie studios.
* Live shows: promoters, venues and managers staging a single show or a short run.

The problem is the same everywhere. Launch plans rest on audience assumptions that nobody writes down, borrowed from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong. Oraqul makes the assumptions explicit and checks each one.

## The three jobs

The three jobs are also the three start modes, called `build`, `audit` and `fix` in code. A job gives one of three kinds of reply: a **plan** (build, and the plan a fix writes), a **report** (audit) or an **answer** (a question inside a project, with no saved output).

**Build (plan).** From a description, Oraqul builds a launch plan with a small core (bottom line, positioning, audience, markets, gaps) and the modules that fit the ask: partnerships, creative placement, publicity, community, release route, timeline, cadence, budget split, what to measure and risks. It plans for the team's own cities, age band and window, tests them, and puts alternatives under Worth a look. Each alternative, a nearby market or an area of a city the team chose, comes with why it fits (cited), what the evidence does not show, a first test and what to measure, and stays beside the plan until the team adds it. A full plan is one plan per territory, home first, with a calendar worked back from the release date, one signal to judge it on, direction calls, channels, partners by tier and short creative briefs ([launch-rules.md](launch-rules.md)). It uses everything the user gives and asks for nothing beyond it, apart from one question after a plan is saved when the draft still rests on something only the person can say.

**Audit.** The user brings an existing plan, as pasted text or an uploaded file. Oraqul pulls out the audience and taste assumptions it makes, tests each one, and marks it as holds, weak, breaks, or could not test, with the sentence of the plan that states it. The answer is a **report**, not a plan: the assumptions grouped by verdict, the risks, the stronger options that Qloo's data points to (worth a look), and what the person can do about each weak or broken one. A team's choices are never advised away: a fix reorders them or adds a stronger option beside them. Audit also answers why a launch fell short. When the launch is out, the user adds the results as aggregates and the report sets each city's results against where the plan put it. Any report ends with one step, Fix this plan, in the same project.

**Fix.** The user brings a plan, before or after launch, and gets a better one. Oraqul audits it under the hood, saves the report, and writes a new plan from it, so the project holds both and the plan says what changed. Before launch it reorders the team's cities by where the audience is strongest and answers each weak or broken assumption. After launch it first asks whether the launch is out, then for the results as aggregates, such as sales or streams by region, or age bands from a platform dashboard, and builds the new plan around the audience that is really there. A report that already exists can be fixed by asking, with no second audit.

**Scenario testing** works inside all three. Change one assumption, such as an older opening audience or a different lead city, and Oraqul shows what changes, as a clear before and after.

## Where the evidence comes from

Four kinds of work, each with its own standard:

* **Measured.** Taste, audience and place come from Qloo, through code, and cite a finding.
* **Sourced.** Dated market facts (rivals, windows, distributors, figures) come from web research and cite a page.
* **Computed.** Every score, verdict and confidence is worked out by code from what Qloo returned, and code checks every line.
* **Written.** The model reads the brief, shapes the questions and writes the plan. Launch craft is labelled playbook and cites nothing.

## The six categories

All six run on one engine. Each has its own questions, output tabs, scenario presets and results format for a launch that is out. Anything else is outside what Oraqul does, and it says so.

* **Film and series distribution.** Audience by age and territory, comparable titles, partner brands, and overlap with rival titles the user names. A launch that is out brings opening results by territory.
* **Music releases and tours.** Support acts, tour cities, partner brands, and home and fan markets for the artist. A launch that is out brings streams and ticket sales by city.
* **Book publishing.** Comparable books, audience by age and place, adaptation and cross media angles, and retail or event partners. A launch that is out brings pre orders, sales by region and review aggregates.
* **Podcasts.** Audience and topic tags, sponsor brands, and guest fit. A launch that is out brings downloads by region and age band from the host dashboard.
* **Games.** Comparable games, fan bases to collaborate with across music and film, and which regions to prioritise. A launch that is out brings wishlists and player counts by region.
* **Live shows.** A single show or a short run: the audience in each city, the lead channels, a sell-through target the team sets, and a final push by intent ([shows-agent.md](../categories/shows.md)). A show that has run brings tickets sold by city.

## How Oraqul uses Qloo, and what it adds

Qloo supplies the taste data: entity search, cross domain affinity, tags, aggregate age and gender skews, location signals and audience comparison. Oraqul adds a layer of published formulas computed by code from values Qloo returned in the same run (lift over a baseline, partner fit, segment fit, rival overlap), and a language model that explains them and never sets a number. Qloo is a taste graph, not a catalogue of releases, so Oraqul does not look up the launch by title: it describes the launch by comparable titles, talent, themes, partner brands and places, and asks Qloo about those. How, and why, is in [principles.md](principles.md); the formulas are in [spec §5](spec.md).

## What Oraqul does not do

* No box office, sales, stream, download or revenue forecasts.
* No pricing advice and no audience headcounts.
* No release calendars from Qloo. The user supplies their own dates and rival list.
* No social media metrics.
* No ads, trailers, images or video. It writes the scripts, shot lists, key art briefs and caption packs a team needs, and a person makes the final creative.
* No partner prices. Price is always unknown.
* No personal data is sent to Qloo. Only public entity names, city names and age bands go out. Uploaded results are aggregates with personal data removed.

The output is always a direction: holds, weak, breaks, or could not test.

## Trust and evidence

* A **grounded** line claims something about taste, audience or place and cites findings; a **playbook** line is labelled launch practice and cites nothing. Code checks every line and drops one that fails.
* A finding is a sentence built by code from one Qloo call. It opens to the raw call, shown in the Evidence tab.
* Every number, verdict and confidence is computed by code. Gaps are stated plainly, with what would change the answer.
* Share links show receipt summaries; raw Qloo data stays with signed in team members.

## How the agent behaves

* One agent per category, behind a thin router that reads the title, category and job from the first message and asks only what it could not read. Agents share one toolbox and do not call each other, apart from two bounded consults (see [agent.md](../backend/agent.md)).
* Plans, reports and briefs run a fixed pipeline, so the same input runs the same tests. Only conversation lets the model choose the next tool call.
* When a title matches several entities, code settles it and the plan says which it used. A dead end is handled by proposing comps or falling back to the genre, and saying so.
* The engine is also exposed as an MCP server so other agents can call it.

## Product structure

Media and entertainment is the one industry Oraqul serves today, in six categories: Film and series, Music, Books, Podcasts, Games and Live shows. The hierarchy is Team, Category, Project, Job, Output; roles are owner, editor and viewer.

* Chat is the entry point. The person says what they want in a few words; the title, category and job are never guessed (one question card when unclear), everything else is guessed and said in one line. Off-topic requests are declined in one line.
* A project is the workspace: its chats beside the current plan. Each output opens its takeaway and a details page with only the tabs that fit it (full list in [spec §9](spec.md)).
* Every capability is something you ask for in the chat. After a plan the chat offers up to three next steps from the latest plan.
* Every line has a receipt; charts have a table view; versions can be compared; a plan exports as PDF, Word or Markdown; a read only share link can be turned off.
* Signed out visitors see sign in and example plans that are real runs on live Qloo data, with what was sent and returned left out, as in a share link. Live runs need an account. On mobile only the core stays: chat, outputs and their details.

## How it looks and reads

Calm and clear, a little cinematic. Neutral surfaces with no tint, a near black ink for text, solid indigo for main actions, focus and selection, and colour for verdicts, directions and the category icons, with a category tint on project cards. The signed-in product uses Geist for headings and running text so dense work reads consistently; Mona Sans is reserved for the public brand and marketing headlines. Cards stand out by fill and a small lift, while full plans and reports sit on flat paper-like surfaces with no elevation. Light and dark are both designed. Motion is small and only marks things arriving: the agent's words appearing, the trace advancing, a view opening. Words are plain, and verdicts are always an icon, a word and a colour together. The design system file has the tokens, components and wording rules. The hosted prototype is the visual reference.

## Every market

Oraqul is a global product. A title from any market is a normal entity, and cities from every region are ranked in one list by lift, whether the release is a Korean series, a Mexican album or a Nigerian novel. Any city can be ranked: the ones in our table directly, and every other city through the place record Qloo holds for it. Coverage differs by place, and it is tested and recorded in `docs/backend/qloo.md` (Nigerian film is the first measured case). Where data for a place is too thin to rank, the product says so plainly and lowers its confidence.

## What makes it different

* Without Qloo it has nothing to say. A chat model can write a launch plan from its training; it cannot know where this audience lives, what else they love or which brands they trust. Oraqul asks Qloo about those and writes up what comes back, so the plan changes when the audience does.
* The plan's cultural claims are measured: the model shapes the questions with cultural context (a music scene, a release country, a city, an age band), which is what makes Qloo's answers sharp.
* The team's decisions are respected: Oraqul plans for their cities and audience, and says what it found about them.
* Every claim about taste cites a finding; launch practice is labelled, so a reader can tell the two apart.
* Plans export to the formats teams send: PDF, Word and Markdown.
* Honest gaps: what was not found, thin or not supported is said plainly.

The demo leads with a plan and the receipts behind its claims.

## Stack

TypeScript monorepo. Next.js front end. A Node backend on a VPS that calls the Qloo API directly through our own client. Vercel AI SDK with a configurable model provider (OpenAI, Google Gemini, or any OpenAI compatible endpoint). Postgres and Docker. A public repository with an open source licence.
