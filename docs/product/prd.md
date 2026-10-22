# Oraqul: Product Requirements

Owners: Wahab and Adedunmola.

## 1. Summary

Oraqul is a culturally grounded launch agent for media and entertainment: launch plans grounded in what audiences actually like.

Oraqul builds, checks and repairs launch plans. Plan a launch, audit the plan you already have, or fix one, before the launch or after it, across films, series, music, books, podcasts and games. Every reply has two stages. First code asks Qloo, the taste data API, the questions the launch needs and turns each answer into a finding. Then the model writes the plan from those findings and its launch knowledge. Every claim about taste, audience or place cites a finding; launch practice is labelled as playbook. Evidence serves the plan, not the other way round.

This document says what to build and why. The spec says how. The design system file says how it looks and reads.

## 2. Problem

Launch plans in media rest on audience assumptions nobody writes down. They come from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong, so the relaunch repeats the same guess.

Existing tools either produce a generic plan with no evidence, or report audience data without saying what to do with it. A chat assistant gives a usable plan in which every cultural claim is a guess. Oraqul gives a plan whose cultural claims are measured: which artists, series, cinemas, brands and communities the launch's audience actually likes, in the team's own cities.

## 3. Users

Launch and marketing teams. One team can work in several categories.

| Category | Who | Typical question |
|---|---|---|
| Film and series | Distributors, sales agents, studios, producers | Is our core audience real, and does this territory need its own plan? |
| Music | Labels, managers, promoters | Which cities and which support act fit this audience? |
| Books | Publishers, publicists | Which comps should we pitch against, and is there a screen angle? |
| Podcasts | Networks, independent studios | Which topics do rival shows not own? |
| Games | Publishers, indie studios | Which fan bases and regions should we go after? |

Roles inside a team: owner, editor, viewer.

## 4. Goals and non goals

Goals

1. Turn a description, however thin, into a launch plan a team can send to distributors, financiers and partners. Use everything the user gives; ask for nothing beyond it.
2. Plan for the team's decisions (cities, age band, window). Test them and say what was found, but never replace them in the bottom line. Alternatives go under Worth a look.
3. Ground every claim about taste, audience or place in a finding from Qloo; label launch practice as playbook.
4. Give a verdict per assumption the plan rests on: holds, weak, breaks, or could not test.
5. Compare who showed up with who the plan assumed, and build a relaunch plan.
6. Let a user change one assumption and see the before and after.
7. State gaps plainly. Never fill them with a guess.

Non goals

* Box office, sales, stream, download, wishlist or revenue forecasts.
* Pricing advice and audience headcounts.
* Release calendars from Qloo. Users supply their own dates and rivals.
* Social media metrics.
* Sending, booking or buying anything. Oraqul drafts only.

## 5. Product structure

Media and entertainment is the one industry Oraqul serves. Its five categories are Film and series, Music, Books, Podcasts and Games.

Hierarchy: Team, Category, Project, Job, Output.

* **Team.** Members and roles. Plans, results and briefs are visible only to the team.
* **Category.** A project belongs to exactly one. The agent reads it from the first message; in the app it is a filter on the project list. A category's list has a help button that says what Oraqul tests, where it is less certain, and what is not supported.
* **Project.** The launch. Holds inputs, threads and outputs.
* **Job.** Plan, Audit, Fix (before or after launch). A job replies with a plan, a report or an answer. Scenario testing, rival date check and partner brief run inside a project.
* **Output.** A saved result with its own details page, evidence and version.

Categories are separate sections, not lanes inside one project. This was chosen because most users never need two categories in one project.

## 6. Requirements

Priority: P0 must ship for the submission, P1 should, P2 later.

### 6.1 Entry and chat

| ID | Requirement | P |
|---|---|---|
| C1 | One chat entry. The user describes the launch, where, and what they have. The agent reads category, kind, genre, places, window, comps, age band, cast, soundtrack, route, budget, partners and the job. It asks only when the minimum is missing: a description or genre, and at least one market. Comps the user names lead; with fewer than 3 the agent proposes more, kept apart ("You named 2. I added 2 more."). A same-name Qloo match is settled by code from year, country and popularity, and the plan states the choice. The user corrects anything by typing. | P0 |
| C2 | The agent asks question cards instead of forms: single, multiple, text, split sliders, date, file, confirm, and entity match. | P0 |
| C3 | The agent trace is shown live and kept collapsed afterwards. Findings appear in it as plain sentences while the queries run. | P0 |
| C4 | A project holds several threads, shown as chats beside the project's current chat. A new chat asks whether to use the project's memory or stand alone. One that uses memory starts on the current plan and the project's notes; a standalone chat sees none of it. | P0 |
| C5 | The agent refuses forecasts and sending, and says why. | P0 |
| C6 | Each category changes the questions, suggested next steps and results format. | P0 |
| C7 | After each output the agent suggests up to three next steps built from it and the project (a scenario not yet tried, results if none are in, a brief or a date check). Each also works typed. | P0 |
| C8 | Memory in two layers. In a chat the agent knows the whole chat. A project remembers key points, decisions and its plans, and keeps them up to date as plans, reports and fixes change; a new plan from the same chat replaces the old one and a plan from another chat sits beside it. | P0 |
| C9 | A new chat asks whether to use the project's memory or stand alone. A standalone chat knows only the category and the project's name and writes nothing to the project's memory. | P0 |
| C10 | The project has a memory list where every note can be rewritten or forgotten. The agent never offers a card to save a fact; it keeps the list itself. | P0 |

### 6.2 The three jobs

| ID | Requirement | P |
|---|---|---|
| J1 | Plan: a minimum core (bottom line, positioning, audience, markets, gaps) plus the modules that fit the ask and the launch (partnerships, creative placement, publicity, community, release route, timeline, cadence, budget split, what to measure, risks). A full plan is the common case; a narrow ask gets the core plus the one module it names. | P0 |
| J2 | Audit: read a pasted or uploaded plan, extract stated and unstated assumptions, test each, mark the source in the plan, and find stronger alternatives for what is weak or broken, without ever advising a team to drop its own choice. The reply is a report: assumptions by verdict, risks, worth a look, and what to do about each. After launch, accept the results and set them against the plan to show why it fell short. Any report offers Fix this plan in the same project. | P0 |
| J3 | Fix, before launch: audit the plan, save the report, and write a new plan from it. Fix, after launch: ask whether it is out, accept results as aggregates by form, file or chat, compare planned and actual audience, find the assumption that broke, and write a new plan around the audience that is there. A fix saves the report and then the plan, and the plan keeps every city and comp the team chose. | P0 |
| J4 | Scenario: change one assumption, rerun only what depends on it, mark changed lines with what they were before. | P0 |
| J5 | Rival date check: user supplies rivals and dates, or uses a public calendar. Oraqul measures shared audience with each rival from one ranking call. | P1 |
| J6 | Partner brief: a draft message that cites its findings. Never sent. | P1 |
| J7 | Answer: a question about the plan is answered from its findings, with the same line kinds and check. If the answer would change a decision, the agent offers it as a scenario. | P0 |

### 6.3 Category packs

Each category supplies its own inputs, query catalog, modules, assumption checklist, scenarios, results format, and signature charts. Film is built on the two stages first; the other categories follow with their own catalog and modules.

| Category | Plan sections | Signature views | A launch that is out brings |
|---|---|---|---|
| Film and series | Core plus modules: partnerships (music, brands), creative placement, publicity, community, route, timeline, cadence, budget, measures, risks | Plan tab, territory ladder | Opening results by age and territory |
| Music | Support acts, partner brands, press and playlists, cities | Tour route with route score, support act grid | Tickets and streams by city and age |
| Books | Comp titles, partner brands, press and events, cities | Comp shelf, adaptation bridge | Pre orders by market and age |
| Podcasts | Cross promotion shows, sponsors, guests, markets | Topic map against rival shows | Downloads by age and market |
| Games | Fan base collabs, creators, press, regions | Fan base bridge, regions ranking | Wishlists by region and day 7 retention |

### 6.4 Evidence and trust

| ID | Requirement | P |
|---|---|---|
| E1 | Two kinds of line, shown the same way. A grounded line claims something about taste, audience or place and cites findings, shown as a quiet number that opens the evidence; its names and numbers must match them. A playbook line is launch practice, which may name anything real (distributors, regulators, rival releases, neighbourhoods) but never claims what an audience likes or states a market figure with no source. The plan speaks plainly: no confidence, data-limit or jargon wording, which live in the Evidence and Assumptions views. Code checks every line and drops one that fails, and the plan still saves. | P0 |
| E2 | Every entity a line names must be in a finding it cites or in the brief. A finding opens to the raw call; call ids appear only in the Evidence tab. | P0 |
| E3 | Gaps are stated as not found, thin, or not supported, with what the agent did next and what input would change the answer. | P0 |
| E4 | Every chart has a table view. | P0 |
| E5 | Evidence tab lists all calls, with the lines that drove the recommendations first. | P0 |
| E6 | Scores are computed by code from Qloo values. The language model explains and never invents numbers. | P0 |
| E7 | Each saved version records the date of its data and can be rerun. | P1 |

### 6.5 Outputs, sharing and export

| ID | Requirement | P |
|---|---|---|
| O1 | The chat shows the whole launch plan as a readable document, with Export and Open plan in its header. The plan's page opens on the Plan tab, with Audience, Assumptions and Evidence behind it. Other outputs keep their summary card and the tabs that fit. | P0 |
| O2 | Compare any two plans line by line. | P0 |
| O3 | Export a plan as PDF, Word (DOCX) or Markdown, each built by the API as a document: the moves first, then the sections, with footnotes to where the audience insights come from and the sources at the end. Raw Qloo data stays out until O4 is settled. | P0 |
| O4 | A read only share link for one output, with an off switch. Receipts on a public link keep their rule and confidence but not what was sent to Qloo or what came back, until Qloo confirms what may be shown. | P0 |
| O5 | Copy summary, copy draft and copy as Markdown. | P0 |

### 6.6 Accounts

| ID | Requirement | P |
|---|---|---|
| A1 | Sign in, teams, roles. Owners invite and remove. Editors run the agent. Viewers read and open receipts. People sign in with email and password, Google, or a one-time email code, and can reset a forgotten password. | P0 |
| A2 | Signed out visitors see sign in and an example of an answer with its receipts. Recorded walkthroughs follow. There is no signup free team, because a demo that cannot make live Qloo calls hides what the product does. | P0 |
| A3 | Mobile keeps chat, outputs and their details. Everything else is desktop only. | P1 |

### 6.7 Agents

| ID | Requirement | P |
|---|---|---|
| G1 | One agent per category, plus a thin router. | P0 |
| G2 | All agents share one toolbox. | P0 |
| G3 | The engine is exposed as an MCP server. | P1 |

### 6.8 Getting started and guidance

The product has many new words and a deep structure, so it must explain itself before any video or guide does. These are product requirements, not marketing.

| ID | Requirement | P |
|---|---|---|
| U1 | The overview opens with a message box. Three optional hints under it, Make a plan, Check my plan, Fix my plan, change the prompt and say what to bring. The first message creates the project. The agent states the job it read in its first reply and the user corrects it by typing ("check my plan instead"); it does not ask a confirm card. | P0 |
| U2 | Every output tab opens with one plain sentence on what it shows. The Assumptions and Evidence notes explain Holds, Breaks and receipts. | P0 |
| U3 | A launch plan opens on Plan, then Audience, Assumptions and Evidence. Other outputs show Summary, Plan, Assumptions and Evidence by default, plus the current tab, and the rest sit under More. Could not test sits at the end of Assumptions; Gaps closes the plan. | P0 |
| U4 | Words stay plain. Verdicts are Holds, Weak, Breaks and Could not test. No jargon without a one line explanation beside it. | P0 |
| U5 | Search on Ctrl K or Cmd K reaches categories, projects, outputs and actions. Number keys pick options on question cards. Both are extras, never the only way. | P1 |
| U7 | Motion marks arrival and progress only: agent text appearing, the trace advancing, views opening. Reduced motion settings are respected. | P1 |

### 6.9 Look and feel

Calm and clear, with a wide geometric grotesque (Space Grotesk) for titles and the bottom line and a clear sans (Geist) for everything else, and a more characterful face only on the landing page, and solid cards that stand out from a neutral canvas by fill and a small lift, with no outlines, solid buttons, small corners and few icons, like an enterprise product people trust with detail. Colour is used for verdicts and for the small category icons, nothing else. No gradients, no coloured side stripes, no dots as status markers. Light and dark are both supported. The full rules, tokens and components are in the design system file.

## 7. Every market

Oraqul is a global product. Titles and artists from any market are normal entities. The team's cities are ranked by lift in one call, together with nearby cities shown only under Worth a look. Examples and marketing copy span regions and never lean on one. If the data for a place is too thin to rank, the product says so on the line and lowers its confidence.

## 8. Success measures

* Share of plans exported or shared (the plan is the product).
* Share of grounded lines against playbook lines, and lines dropped by the check, per category.
* Share of assumptions that end as holds, weak, breaks, could not test, per category.
* Fix completion: share of fixes for a launch that is out that finish with results applied.
* Rerun cost: Qloo calls per audit, kept under the call budget.
* First use comprehension: in a test with five or six launch marketers, most can say what Holds and Breaks mean and find a receipt without help.

## 9. Risks

| Risk | What we do |
|---|---|
| Qloo may know little about the surroundings of a launch (measured so far, on hand picked and mostly popular titles: age and gender profiles exist for about half of books and for 37 of 40 films, series, artists, podcasts and games, Nigerian ones included; nothing else is measured, and obscure titles are untested) | The launch is described by its anchors, not looked up. Probe coverage per category first. State gaps on the line. Confidence follows how many and how strong the anchors are. |
| A cross-domain overlap is read as a verdict without a baseline | A clear gap above the baseline is evidence for. Qloo always returns a score, so a low score means little alone and counts as weak only against a baseline scored in the same call. |
| Qloo terms may limit public receipts | Share links show summaries only until confirmed. |
| Call quota (reported near 10,000 a month) | Set a call budget per run. Cache within a run. Rerun only what changed. |
| Scores from separate calls are not comparable | Rival overlap, city ranking and scenario diffs come from one call. |
| The product is hard to understand at first | One message box to start, few questions, the answer shown in the chat, tab notes, fewer tabs, plain words, an example answer on the sign in page. Test wording with real marketers before polishing visuals. |
| Five categories is a lot of surface | One engine, one toolbox, five packs. A new category is a new pack, not new code. |
