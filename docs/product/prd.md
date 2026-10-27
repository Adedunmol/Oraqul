# Oraqul: Product Requirements

Owners: Wahab and Adedunmola.

## 1. Summary

Oraqul is a culturally grounded launch agent for media and entertainment: launch plans grounded in what audiences actually like.

Oraqul is built to stop launches failing and to make them pay. It builds a launch plan, audits the plan a team already has, fixes the weak decisions in it, and, once the launch is out, reads the results the team supplies and revises the plan around the audience that showed up. That covers films, series, music, books, podcasts, games and live shows. The journey is research, plan, campaign, then revision from results; a plan is a document, an audit is a report, a fix is a revised plan backed by an audit, and an answer is a short reply in the chat.

Every reply has two stages. First code asks Qloo, the taste data API, the questions the launch needs and turns each answer into a finding. Then the model writes the plan from those findings and its launch knowledge. Every claim about taste, audience or place cites a finding; launch practice is labelled as playbook. Evidence serves the plan, not the other way round.

This document says what to build and why. The spec says how. The design system file says how it looks and reads.

## 2. Problem

Launch plans in media rest on audience assumptions nobody writes down. They come from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong, so the relaunch repeats the same assumption.

Existing tools either produce a generic plan with no evidence, or report audience data without saying what to do with it. A chat assistant gives a usable plan, but its cultural claims come from memory and nothing checks them. Oraqul gives a plan whose cultural claims are measured: which artists, series, cinemas, brands and communities the launch's audience actually likes, in the team's own cities.

## 3. Users

Launch and marketing teams. One team can work in several categories.

| Category | Who | Typical question |
|---|---|---|
| Film and series | Distributors, sales agents, studios, producers | Is our core audience real, and does this territory need its own plan? |
| Music | Labels, managers, promoters | Which cities and which support act fit this audience? |
| Books | Publishers, publicists | Which comps should we pitch against, and is there a screen angle? |
| Podcasts | Networks, independent studios | Which topics do rival shows not own? |
| Games | Publishers, indie studios | Which fan bases and regions should we go after? |
| Live shows | Promoters, venues, managers | Which cities hold the audience for this show, and what should the final push say? |

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

* Box office, sales, stream, download, wishlist or revenue forecasts. A target is a goal the team sets, or a sourced benchmark, and is never a prediction.
* Generating ads, trailers, images or video. Oraqul writes the scripts, shot lists and briefs a team needs, and a person makes the creative.
* Pricing advice and audience headcounts.
* Release calendars from Qloo. Users supply their own dates and rivals.
* Social media metrics.
* Sending, booking or buying anything. Oraqul drafts only, and anything that leaves Oraqul goes out only after a person approves it.

## 5. Product structure

Media and entertainment is the one industry Oraqul serves. Its six categories are Film and series, Music, Books, Podcasts, Games and Live shows.

Hierarchy: Team, Category, Project, Job, Output.

* **Team.** Members and roles. Plans, results and briefs are visible only to the team.
* **Category.** A project belongs to exactly one. The agent reads it from the first message; in the app it is a filter on the project list. A category's list has a help button that says what Oraqul tests, what else it handles, and what the team brings.
* **Project.** The launch. Holds inputs, threads and outputs.
* **Job.** Plan, Audit, Fix (before or after launch). A job replies with a plan, a report or an answer. Scenario testing, rival date check and partner brief run inside a project.
* **Output.** A saved result with its own details page, evidence and version.

Categories are separate sections, not lanes inside one project. This was chosen because most users never need two categories in one project.

## 6. Requirements

Priority: P0 must ship for the submission, P1 should, P2 later.

### 6.1 Entry and chat

| ID | Requirement | P |
|---|---|---|
| C1 | One chat entry. The user describes the launch, where, and what they have. The agent reads category, kind, genre, places, window, comps, age band, cast, soundtrack, route, budget, partners and the job. It asks only when the minimum is missing: a description or genre, and at least one market. A full plan whose brief states no budget or band also asks one band card before any research (R6). One exception comes after delivery: when the red team's last draft still has a blocking issue that only the person can settle, the plan is saved and one question follows ("Leave it as it is", or type the answer). Comps the user names lead; with fewer than 3 the agent proposes more, kept apart ("You named 2. I added 2 more."). A same-name Qloo match is settled by code from year, country and popularity, and the plan states the choice. The user corrects anything by typing. | P0 |
| C2 | The agent asks question cards instead of forms: single, multiple, text, split sliders, date, file, confirm, and entity match. | P0 |
| C3 | The agent trace is shown live and kept collapsed afterwards. Findings appear in it as plain sentences while the queries run. | P0 |
| C4 | A project holds several threads, shown as chats beside the project's current chat. A new chat asks whether to use the project's memory or stand alone. One that uses memory starts on the current plan and the project's notes; a standalone chat sees none of it. | P0 |
| C5 | The agent refuses forecasts and sending, and says why. | P0 |
| C6 | Each category changes the questions, suggested next steps and results format. | P0 |
| C7 | After each output the agent suggests up to three next steps built from it and the project (a scenario not yet tried, a partner brief, a date check or the creative kit). Suggesting that results be added is not built. Each also works typed. | P0 |
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
| J5 | Rival date check: the user supplies rivals and dates, in the brief or later in the chat. Qloo has no release calendar. Oraqul measures shared audience with each rival from one ranking call, and in a build calls each date okay, risky or avoid (R5). | P1 |
| J6 | Partner brief: a draft message that cites its findings. Never sent. | P1 |
| J7 | Answer: a question about the plan is answered from its findings, with the same line kinds and check. If the answer would change a decision, the agent offers it as a scenario. | P0 |
| J8 | Campaign: a plan with a content calendar can be set up as actions in the project, one for each calendar row, each with a guide from the creative kit that the team adapts. The team edits an action and ticks it off. A revised plan gets its own set and the earlier set is never changed; the page says which version a set belongs to. An action can carry a two-angle test: each angle with its reasoning, one thing to measure, and no predicted winner. The checklist is dated, and a launch watch alerts the team when an action slips (J10). The plan's dates can be downloaded as a calendar file or subscribed to as a feed of titles and dates. Nothing is published or posted for the team. | P1 |
| J9 | What changed: a saved plan can be checked against today's data on request, in the chat or as a suggested step on an older plan. Findings that moved, web pages that now say something different (each with the day it was read), what is newly found, the plan lines that rest on them and what the check could not do are shown. Something is called changed only when the plan saved an earlier finding or fact to compare. The plan is not changed; a revision is built only when the team asks. | P1 |
| J10 | Launch Watch: a saved launch plan can be watched. On a schedule that survives a restart, Oraqul re-checks rival release dates near the plan's (from the web, each with its page and the day it was read), campaign actions past their date, a plan that has grown old, and the team's own figures. It raises events with a severity and a reason, emails the team's owners and editors one digest, and shows the events on the plan's Watch tab with an unread count on the project. A watch never changes the plan and never asks Qloo. An owner or editor approves an event to start a normal check or rescue. | P1 |
| J11 | Actuals and pace: the team enters real figures for the plan's one signal as pasted lines or a CSV. Code says whether they are ahead, on pace, behind or too early to tell, with the gap and how much it rests on, against a pace convention the team can edit. Direction only, never a forecast. | P1 |
| J13 | Funding and sponsors: for a full plan, the brands Qloo ranks for each territory with a recent sponsorship a page confirms, and funds, grants and programmes open now, found on the web at run time, each field the page's own or unknown, each fund with its source and the day it was read and an eligibility computed in code ("Published criteria met", "Check" or "Not eligible", never "qualifies"). A pipeline from found to won, a draft built from the plan, and a handoff that opens the person's own email or WhatsApp. Oraqul never sends, never quotes a fee or loan terms and never gives financial advice or brokers financing. | P1 |
| J14 | Team defaults: owners and editors paste how every plan should be written and save, and the rules are live at once, each shown as a plain sentence with its source, whether code enforces it and what it clashes with; only an owner sets who must approve. A budget ceiling, territories, banned partners, channels and who approves are enforced in code; tone, language, brand safety and topics are given to the writer and the red team. A rule that discriminates, hides results, changes verdicts or instructs the model is rejected with a reason. | P1 |
| J12 | Rescue: when the figures are behind, a person asks for or approves a rescue. It names the territory and channel to put the next seven days into, from the plan's own findings and the figures, and is saved as an output of the plan. | P1 |

### 6.3 Category packs

Each category supplies its own inputs, query catalog, modules, assumption checklist, scenarios, results format, and signature charts. Film is built on the two stages first; the other categories follow with their own catalog and modules.

| Category | Plan sections | Signature views | A launch that is out brings |
|---|---|---|---|
| Film and series | Core plus modules: partnerships (music, brands), creative placement, publicity, community, route, timeline, cadence, budget, measures, risks | Plan tab, Territories (one plan per territory) | Opening results by age and territory |
| Music | Support acts, partner brands, press and playlists, cities | Plan tab, Tour route with route score, Support acts | Tickets and streams by city and age |
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
| A2 | Signed out visitors see sign in and an example of an answer with its receipts. Recorded walkthroughs follow. There is no signup free team, because a demo that cannot make live Qloo calls hides what the product does. A reviewer's account can be given its own run cap. | P0 |
| A3 | Mobile keeps chat, outputs and their details. Everything else is desktop only. | P1 |

### 6.7 Agents

| ID | Requirement | P |
|---|---|---|
| G1 | One agent per category, plus a thin router. | P0 |
| G2 | All agents share one toolbox. | P0 |
| G3 | Oraqul is exposed as a hosted MCP server over streamable HTTP for the plan pipeline: build, audit and fix a plan, follow the run and read the finished summary and watch events, with a personal token for each person and team, the web app's role checks, the same run cap and Qloo budget, and no raw Qloo data. The Qloo tools stay a separate local stdio server. It cannot send, confirm a send, change team defaults or make tokens. | P1 |

### 6.8 Getting started and guidance

The product has many new words and a deep structure, so it must explain itself before any video or guide does. These are product requirements, not marketing.

| ID | Requirement | P |
|---|---|---|
| U1 | The overview opens with a message box. Three optional hints under it, Make a plan, Check my plan, Fix my plan, change the prompt and say what to bring. The first message creates the project. The agent states the job it read in its first reply and the user corrects it by typing ("check my plan instead"); it does not ask a confirm card. | P0 |
| U2 | Every output tab opens with one plain sentence on what it shows. The Assumptions and Evidence notes explain Holds, Breaks and receipts. | P0 |
| U3 | A launch plan opens on Plan, then Audience, Assumptions and Evidence. Other outputs show Summary, Plan, Assumptions and Evidence by default, plus the current tab, and the rest sit under More. Could not test sits at the end of Assumptions; To sharpen this plan sits beneath the plan. | P0 |
| U4 | Words stay plain. Verdicts are Holds, Weak, Breaks and Could not test. No jargon without a one line explanation beside it. | P0 |
| U5 | Search on Ctrl K or Cmd K reaches categories, projects, outputs and actions. Number keys pick options on question cards. Both are extras, never the only way. | P1 |
| U7 | Motion marks arrival and progress only: agent text appearing, the trace advancing, views opening. Reduced motion settings are respected. | P1 |

### 6.9 Look and feel

Calm and clear. The signed-in product uses Geist for headings, running text and the body of a plan, so dense work reads in one steady voice; Mona Sans is reserved for the public brand and marketing headlines. Solid cards stand out from a neutral canvas by fill and a small lift, while full plans and reports use flat paper-like surfaces with no elevation, clear section rules, generous reading space and few icons, like enterprise software people trust with detail. Colour is used for verdicts and directions, for the category icons and the category tint of project cards, and indigo for actions. One soft gradient per marketing page and none in the app, no coloured side stripes, no dots as status markers. Light and dark are both supported. The full rules, tokens and components are in the design system file.

### 6.10 Launch rules

The craft around the data is a versioned rule library per category, each rule with its source and date ([launch-rules.md](launch-rules.md)). A plan records the version it used.

| ID | Requirement | P |
|---|---|---|
| R1 | Plans work backwards from the release date, in code, for every category. A beat already over is dropped. | P0 |
| R2 | One primary signal per plan, with the team's target or a sourced benchmark labelled a target and not a forecast. Followers and views are secondary. | P0 |
| R3 | Rival dates the user supplies are checked against the comps' audience inside a build, not only afterwards. | P0 |
| R4 | One plan per territory, home first, then the diaspora cities. The team's cities are never dropped. | P0 |
| R5 | Okay, risky or avoid on each opening date, territory and partner, set by code with the confidence of its finding. A call on a team choice keeps the choice. | P0 |
| R6 | A full plan with no budget or band asks for a band first, once. It proposes only what the band can carry. | P0 |
| R7 | Channels by audience: music and books lead on short video, film and podcasts on YouTube, games on YouTube, TikTok and Discord, live shows on Instagram, TikTok and X, Nigeria on Instagram and TikTok, with WhatsApp only as a sharing layer and never a lead channel. The team picks the platforms from a suggested list. | P0 |
| R8 | Guides and scripts only. Every full plan has short creative briefs; a creative kit gives hooks, a script outline, a shot list, a key art brief and a caption pack for a territory and channel. Requests to generate an ad, trailer, image or video are refused. | P0 |
| R9 | Partners come in tiers A, B and C with their Qloo fit and budget fit, and price unknown. | P0 |

### 6.11 Help

| ID | Requirement | P |
|---|---|---|
| U8 | A public Guide explains what to put in a brief and why, builds one field by field in the forms Oraqul reads, shows which details are still missing, and opens the app with the text. It also lists the launch rules with their sources, has a page for each part of using Oraqul, and a free help assistant on every Guide page that answers from those pages, with limits per visitor and per day. | P1 |

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
| Six categories is a lot of surface | One engine, one toolbox, six packs. A new category is a new pack, not new code. |
