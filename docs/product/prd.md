# Oraqul: Product Requirements

Owners: Wahab and Adedunmola.

## 1. Summary

Oraqul is a verifiable AI agent for launch planning in media and entertainment.

Oraqul builds, checks and repairs launch plans. Plan a launch, audit the plan you already have, or rescue and relaunch one that missed, across films, series, music, books, podcasts and games. Each audience assumption is tested against real taste data from Qloo, so you see what holds and what breaks, with a receipt on every claim.

Oraqul is a verifiable AI agent that builds, checks and repairs launch plans in media and entertainment.

This document says what to build and why. The spec says how. The design system file says how it looks and reads.

## 2. Problem

Launch plans in media rest on audience assumptions nobody writes down. They come from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong, so the relaunch repeats the same guess.

Existing tools either produce a generic plan with no evidence, or report audience data without saying what to do with it. Neither shows its work in a form a team can check line by line.

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

1. Turn a description or an existing plan into a list of explicit audience assumptions, each tested.
2. Give a verdict per assumption: holds, weak, breaks, or could not test, with a receipt.
3. Find a better plan than the one given, and show what changed.
4. Compare who showed up with who the plan assumed, and build a relaunch plan.
5. Let a user change one assumption and see the before and after.
6. State gaps plainly. Never fill them with a guess.

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
* **Job.** Plan, Audit, Rescue (includes relaunch). Scenario testing, rival date check and partner brief run inside a project.
* **Output.** A saved result with its own details page, evidence and version.

Categories are separate sections, not lanes inside one project. This was chosen because most users never need two categories in one project.

## 6. Requirements

Priority: P0 must ship for the submission, P1 should, P2 later.

### 6.1 Entry and chat

| ID | Requirement | P |
|---|---|---|
| C1 | One chat entry. The user describes the launch, where, and what they have. The agent reads category, kind, genre, places, window, and the job. It asks only when a wrong assumption would waste the run (no category or title found, an ambiguous Qloo match). Otherwise it guesses, says what it read and guessed in one line, and the user corrects it by typing. | P0 |
| C2 | The agent asks question cards instead of forms: single, multiple, text, split sliders, date, file, confirm, and entity match. | P0 |
| C3 | The agent trace is shown live and kept collapsed afterwards. | P0 |
| C4 | A project holds several threads, shown as chats beside the project's current chat. A new one builds on the current plan without asking and says what context it pulled in. The user can type "start fresh" or "use an older plan" to change that. | P0 |
| C5 | The agent refuses forecasts and sending, and says why. | P0 |
| C6 | Each category changes the questions, suggested next steps and results format. | P0 |
| C7 | After each output the agent suggests up to three next steps built from it and the project (a scenario not yet tried, results if none are in, a brief or a date check). Each also works typed. | P0 |
| C8 | Memory in three layers. In a chat the agent knows the whole chat. A project's chats share what the project knows (its inputs, current plan and facts the person confirmed). A team's standing facts (home market, usual territories, language, usual partners) apply to every project. The chat says which memory it used. | P0 |
| C9 | A new chat asks whether to continue from the project or start fresh. Fresh ignores project memory and the earlier plan. Team memory can be switched off for that chat. Typed "start fresh" does the same. | P0 |
| C10 | The agent offers to remember a fact ("Remember that you launch in Lagos first?") as a card with project, team or not now. Nothing is saved without a yes. The team and each project have a memory list where every item can be edited, archived or deleted, and says where it came from. | P0 |

### 6.2 The three jobs

| ID | Requirement | P |
|---|---|---|
| J1 | Plan: audience by segment, assumptions, plan sections for the category, risks with early warning signals, and what could not be tested. | P0 |
| J2 | Audit: read a pasted or uploaded plan, extract stated and unstated assumptions, test each, mark the source in the plan, and find stronger alternatives for what broke. | P0 |
| J3 | Rescue: accept results as aggregates by form, file or chat. Compare planned and actual audience, find the assumption that broke, rebuild the plan, and write next steps, places still to plan and what to stop. | P0 |
| J4 | Scenario: change one assumption, rerun only what depends on it, mark changed lines with what they were before. | P0 |
| J5 | Rival date check: user supplies rivals and dates, or uses a public calendar. Oraqul measures shared audience with each rival from one ranking call. | P1 |
| J6 | Partner brief: a draft message with the evidence attached. Never sent. | P1 |

### 6.3 Category packs

Each category supplies its own inputs, plan sections, assumption checklist, scenarios, results format, and signature charts.

| Category | Plan sections | Signature views | Rescue takes |
|---|---|---|---|
| Film and series | Trailer pairings, partner brands, press and podcasts, cities | Territory ladder | Opening results by age and territory |
| Music | Support acts, partner brands, press and playlists, cities | Tour route with route score, support act grid | Tickets and streams by city and age |
| Books | Comp titles, partner brands, press and events, cities | Comp shelf, adaptation bridge | Pre orders by market and age |
| Podcasts | Cross promotion shows, sponsors, guests, markets | Topic map against rival shows | Downloads by age and market |
| Games | Fan base collabs, creators, press, regions | Fan base bridge, regions ranking | Wishlists by region and day 7 retention |

### 6.4 Evidence and trust

| ID | Requirement | P |
|---|---|---|
| E1 | Every line has a verdict or fit score, a confidence level, and a receipt: endpoint, input, what came back, how the verdict was reached, time. | P0 |
| E2 | Every entity the agent names must appear in data Qloo returned in that run. | P0 |
| E3 | Gaps are stated as not found, thin, or not supported, with what the agent did next and what input would change the answer. | P0 |
| E4 | Every chart has a table view. | P0 |
| E5 | Evidence tab lists all calls, with the lines that drove the recommendations first. | P0 |
| E6 | Scores are computed by code from Qloo values. The language model explains and never invents numbers. | P0 |
| E7 | Each saved version records the date of its data and can be rerun. | P1 |

### 6.5 Outputs, sharing and export

| ID | Requirement | P |
|---|---|---|
| O1 | Every output ends in a summary, a decision first takeaway card one click from the chat (the agent's message states the bottom line; the card opens in a dialog), and its own details page with only the tabs that fit. | P0 |
| O2 | Compare any two plans line by line. | P0 |
| O3 | Export a one page brief with an evidence appendix and confidence per line. | P0 |
| O4 | A read only share link for one output, with an off switch. Raw Qloo data is not shown on public links until Qloo confirms what may be shown. | P0 |
| O5 | Copy summary and copy draft. | P0 |

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
| G2 | All agents share one toolbox and one red team step. | P0 |
| G3 | The engine is exposed as an MCP server. | P1 |

### 6.8 Getting started and guidance

The product has many new words and a deep structure, so it must explain itself before any video or guide does. These are product requirements, not marketing.

| ID | Requirement | P |
|---|---|---|
| U1 | The overview opens with a message box. Three optional hints under it, Make a plan, Check my plan, Fix one that missed, change the prompt and say what to bring. The first message creates the project. The agent states the job it read in its first reply and the user corrects it by typing ("check my plan instead"); it does not ask a confirm card. | P0 |
| U2 | Every output tab opens with one plain sentence on what it shows. The Assumptions and Evidence notes explain Holds, Breaks and receipts. | P0 |
| U3 | Output pages show Summary, Plan, Assumptions and Evidence by default, plus the current tab. The rest sit under More. Could not test sits at the end of Assumptions and Risks at the end of Plan, not on tabs of their own. | P0 |
| U4 | Words stay plain. Verdicts are Holds, Weak, Breaks and Could not test. No jargon without a one line explanation beside it. | P0 |
| U5 | Search on Ctrl K or Cmd K reaches categories, projects, outputs and actions. Number keys pick options on question cards. Both are extras, never the only way. | P1 |
| U7 | Motion marks arrival and progress only: agent text appearing, the trace advancing, views opening. Reduced motion settings are respected. | P1 |

### 6.9 Look and feel

Calm and clear, with a wide geometric grotesque (Space Grotesk) for titles and the bottom line and a clear sans (Geist) for everything else, and a more characterful face only on the landing page, and solid cards that stand out from a neutral canvas by fill and a small lift, with no outlines, solid buttons, small corners and few icons, like an enterprise product people trust with detail. Colour is used for verdicts and for the small category icons, nothing else. No gradients, no coloured side stripes, no dots as status markers. Light and dark are both supported. The full rules, tokens and components are in the design system file.

## 7. Every market

Oraqul is a global product. Titles and artists from any market are normal entities, and cities from every region are ranked by lift in one list. Examples and marketing copy span regions and never lean on one. If the data for a place is too thin to rank, the product says so on the line and lowers its confidence.

## 8. Success measures

Hackathon

* The recorded walkthrough shows a rescue and a scenario diff in under three minutes.
* Every claim in the walkthrough opens a receipt.
* Each of the five categories runs end to end with its own views.
* A first time viewer types one message and reaches a first result without help.

Product

* Share of assumptions that end as holds, weak, breaks, could not test, per category.
* Share of outputs where the user opens at least one receipt.
* Rescue completion: share of rescue threads that finish with results applied.
* Rerun cost: Qloo calls per audit, kept under the call budget.
* First use comprehension: in a test with five or six launch marketers, most can say what Holds and Breaks mean and find a receipt without help.

## 9. Risks and open points

| Risk | What we do |
|---|---|
| Qloo may know little about the surroundings of a launch (measured so far, on hand picked and mostly popular titles: age and gender profiles exist for about half of books and for 37 of 40 films, series, artists, podcasts and games, Nigerian ones included; nothing else is measured, and obscure titles are untested) | The launch is described by its anchors, not looked up. Probe coverage per category first. State gaps on the line. Confidence follows how many and how strong the anchors are. |
| A cross-domain overlap is read as a verdict without a baseline | A clear gap above the baseline is evidence for. Qloo always returns a score, so a low score means little alone and counts as weak only against a baseline scored in the same call. |
| Qloo terms may limit public receipts | Share links show summaries only until confirmed. |
| Call quota (reported near 10,000 a month) | Set a call budget per audit. Cache within a run. Rerun only what changed. |
| Scores from separate calls are not comparable | Rival overlap, city ranking and scenario diffs come from one call. |
| Qloo details came from secondhand sources | Confirm against Qloo's docs and our own key before building. |
| Devpost team rules for two people | Confirm before submission. |
| The product is hard to understand at first | One message box to start, few questions, the answer shown in the chat, tab notes, fewer tabs, plain words, an example answer on the sign in page. Test wording with real marketers before polishing visuals. |
| Five categories is a lot of surface | One engine, one toolbox, five packs. A new category is a new pack, not new code. |

Open points to close first: cross-domain tests per category, Africa entity coverage, Lagos against no location, whether location changes age and gender splits, podcast and game coverage, quota header.

## 10. Milestones to October 31

| When | Done |
|---|---|
| Oct 13 to 15 | Qloo live tests. Monorepo, Qloo client, receipts, verdict engine. Design tokens and base components from the design system. |
| Oct 16 to 20 | Film and Music agents end to end. Chat, trace, outputs, evidence. |
| Oct 21 to 25 | Books, Podcasts, Games packs. Rescue and scenarios in all five. |
| Oct 26 to 28 | Accounts, share, export, compare. MCP server. |
| Oct 29 to 30 | Testing, demo video, write up, public repository and licence. |
| Oct 31, 4:45am GMT+1 | Submitted. |
