# Oraqul: Product Overview

## One liner

Launch plans grounded in what audiences actually like.

Oraqul is a culturally grounded launch agent for media and entertainment. It builds, checks and repairs launch plans across films, series, music, books, podcasts and games. Its cultural claims (which artists, series, cinemas, brands and communities the audience likes, in which cities) are measured in Qloo taste data, so the plan is better than a chat assistant's, not just better documented.

## What it is

Oraqul is a culturally grounded agent that builds, checks and repairs launch plans in media and entertainment. Oraqul is an agent for the teams that launch cultural products. It does three jobs: it plans a launch, audits a launch plan, and rescues a launch that underperformed, which is a relaunch. There is one entry point. The user describes what they are launching, where, and what they already have, and the agent works out both the category and the job.

Every reply has two stages. First, findings: the model reads the brief and shapes the questions, code asks Qloo and turns each answer into a sentence, and the findings stream into the chat while they land. Then the reply: the model writes the plan from the findings and its launch knowledge, and code checks every line. It gives direction, never forecasts.

## Who it is for

Launch and marketing teams in five categories. Each category is its own section of the product, with its own agent, inputs, charts and scenarios:

* Film and series: distributors, sales agents, studios and producers.
* Music: labels, managers and promoters.
* Books: publishers and publicists.
* Podcasts: networks and independent studios, meaning business teams, not solo hosts.
* Games: publishers and indie studios.

The problem is the same everywhere. Launch plans rest on audience assumptions that nobody writes down, borrowed from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong. Oraqul makes the assumptions explicit and checks each one.

## The three jobs

The three jobs are also the three start modes, called `build`, `audit` and `rescue` in code.

**Build (plan).** From a description, Oraqul builds a launch plan with a small core (bottom line, positioning, audience, markets, gaps) and the modules that fit the ask: partnerships, creative placement, publicity, community, release route, timeline, cadence, budget split, what to measure and risks. It plans for the team's own cities, age band and window, tests them, and puts alternatives under Worth a look. It uses everything the user gives and asks for nothing beyond it.

**Audit.** The user brings an existing plan. Oraqul pulls out the audience and taste assumptions it makes, tests each one, and marks it as holds, weak, breaks, or could not test. It then looks for stronger alternatives to whatever broke and tests those too.

**Rescue.** The launch is out and results are weak. The user adds actual results as aggregates, such as sales or streams by region, or age bands from a platform dashboard. Oraqul compares who actually showed up with who the plan assumed, finds which assumption was wrong, and builds a relaunch plan around the audience that is really there.

**Scenario testing** works inside all three. Change one assumption, such as an older opening audience or a different lead city, and Oraqul shows what changes, as a clear before and after.

## The five categories

All five run on one engine. Each has its own questions, output tabs, scenario presets and results format for rescue. A generic template handles anything else and says plainly that it is less certain.

* **Film and series distribution.** Audience by age and territory, comparable titles, partner brands, and overlap with rival titles the user names. Rescue takes opening results by territory.
* **Music releases and tours.** Support acts, tour cities, partner brands, and home and fan markets for the artist. Rescue takes streams and ticket sales by city.
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

Qloo is a taste graph, not a catalogue of releases. A launch is usually not in it yet, and a live title can still be a weak signal, so Oraqul does not look for the title. It describes the launch by what surrounds it (comparable titles, talent, themes and tags, partner brands, places) and asks Qloo about that. It can also test taste across domains, for example whether the fans of top selling musicians also read books like this one. Each is scored in one call against titles of other kinds, because Qloo always returns a score and a low one means little alone. A clear gap above the baseline is evidence for. A low score is read as weak only against that baseline.

## What Oraqul does not do

* No box office, sales, stream, download or revenue forecasts.
* No pricing advice and no audience headcounts.
* No release calendars from Qloo. The user supplies their own dates and rival list.
* No social media metrics.
* No personal data is sent to Qloo. Only public entity names, city names and age bands go out. Uploaded results are aggregates with personal data removed.

The output is always a direction: holds, weak, breaks, or could not test.

## Trust and evidence

* Two kinds of line. A **grounded** line claims something about taste, audience or place and cites findings; its names and numbers must match them. A **playbook** line is launch practice, labelled, citing nothing, and may not claim what an audience likes. Code checks every line and drops one that fails.
* A finding is a sentence built by code from one Qloo call, such as "In Lagos, the Afrobeats artists that rank highest with your comps' audience are Tems, Libianca and Rema." It opens to the raw call. Call ids appear only in the Evidence tab.
* Every number, verdict and confidence is computed by code from what Qloo returned.
* Gaps are stated plainly as not found, thin, or not supported, with what the agent did next and what input would change the answer.
* Each saved version records the date of its data and can be rerun with fresh data.
* Share links show receipt summaries. Raw Qloo data stays with signed in team members until Qloo confirms what may be shown publicly.

## How the agent behaves

* There is one category agent per category: Film and series, Music, Books, Podcasts and Games. A thin router reads the title, category and job from the first message and hands the project to that agent. The router speaks only to ask what it could not read, or to decline an off-topic request.
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
* A project belongs to exactly one category, because most people will not need several categories in one project. The agent reads the category from the first message, so people do not pick it first: categories are a filter on the project list, and a category's list has a help button that opens what Oraqul tests there, where it is less certain, what the team must bring, and the tools it has.
* Chat is the entry point. The person says what they want in a few words and the agent does the rest. The title, the category and the job are never guessed: when one is unclear the agent says what it understood and asks one question card with close options, and the person can type their own answer. It also asks which Qloo title is theirs. Everything else it guesses, says what it guessed in one line, and lets the person correct it by typing. A request that has nothing to do with launches is declined in one line. The questions, suggested next steps and results format change with the category.
* A project is the workspace: its chat, its other chats beside it, and the current plan on top. A project holds several chats (threads in code). A new one builds on the current plan and says so; the person can type "start fresh" or "use an older plan" instead.
* Every agent output states its bottom line in the chat and opens its takeaway card, up to three moves with their receipts, in one click, then opens its own details page with only the tabs that fit it. Common tabs are Summary, Audience, Assumptions (with what could not be tested at the end), Plan (with its risks at the end) and Evidence. Each category adds its own: territory ladder for film, tour route and support act grid for music, comp shelf and adaptation bridge for books, topic map for podcasts, fan base bridge and regions for games.
* After each output the agent suggests up to three next steps built from it, such as a scenario not yet tried or adding results. Every capability is something you can ask for in the chat, not a separate screen.
* Every line has a receipt. Charts have a table view.
* Versions can be compared. A plan exports as PDF, Word or Markdown, with grounded lines footnoted to their findings, playbook lines labelled and an evidence appendix.
* A read only share link can be turned off.
* The overview, the team's home after sign in, opens with a message box: "What are you working on?". Under it, three optional hints (plan a launch, check a plan I have, rescue one that missed) change the prompt and say what to bring. The project is made from the first message, never from an empty form.
* Every output tab opens with one plain sentence on what it shows, and output pages show four main tabs with the rest under More.
* Search on Ctrl K or Cmd K finds categories, projects, outputs and actions.
* Signed out visitors see sign in and an example answer. Live runs need an account, so the demo shows what the product really does.
* On mobile, only the core stays: chat, outputs and their details.

## How it looks and reads

Calm and clear, a little cinematic. Neutral surfaces with no tint, a near black ink for text, solid indigo for main actions, focus and selection, and colour only for verdicts and the small category icons. A wide geometric grotesque (Space Grotesk) for titles and the bottom line, a clean sans (Geist) for everything else, and a more characterful face on the landing page only, and solid cards that stand out by fill and a small lift with no outlines, small corners and few icons. Light and dark are both designed. Motion is small and only marks things arriving: the agent's words appearing, the trace advancing, a view opening. Words are plain, and verdicts are always an icon, a word and a colour together. The design system file has the tokens, components and wording rules. The hosted prototype is the visual reference.

## Every market

Oraqul is a global product. A title from any market is a normal entity, and cities from every region are ranked in one list by lift, whether the release is a Korean series, a Mexican album or a Nigerian novel. Coverage differs by place, and it is tested and recorded in `docs/backend/qloo.md` (Nigerian film is the first measured case). Where data for a place is too thin to rank, the product says so plainly and lowers its confidence.

## What makes it different

* The plan's cultural claims are measured, not guessed: the model shapes the questions with cultural context (a music scene, a release country, a city, an age band), which is what makes Qloo's answers sharp.
* The team's decisions are respected: Oraqul plans for their cities and audience, and says what it found about them.
* Every claim about taste cites a finding; launch practice is labelled, so a reader can tell the two apart.
* Plans export to the formats teams send: PDF, Word and Markdown.
* Honest gaps instead of confident guesses.

The demo leads with the plan side by side with a chat assistant's answer to the same brief.

## Stack

TypeScript monorepo. Next.js front end. A Node backend on a VPS that calls the Qloo hackathon API directly through our own client. Vercel AI SDK with a configurable model provider (OpenAI, Google Gemini, or any OpenAI compatible endpoint). Postgres and Docker. A public repository with an open source licence for the submission.
