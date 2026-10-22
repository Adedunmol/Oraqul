# How Film planning works

A technical overview, from the first message to a saved plan and its follow ups. Product rules are in the [spec](../product/spec.md): §4.1 the query catalog, §5 the numbers, §6.1 the launch plan, §6.2 the line check. This page is the map.

## The one idea

The film being launched is usually not in Qloo yet. So the agent describes it by its **comps** (comparable titles the audience already watches) and asks Qloo what their audience likes. On its own a comp signal drifts toward what is popular overall. With context (a music scene, a release country, a city, an age band, a year) it gets sharp. So every reply has two stages:

1. **Findings (code).** The model reads the brief and shapes the queries. Code runs them and turns each result into a finding: a sentence built from one call, streamed into the chat as it lands.
2. **The reply (model).** The model writes the plan, or an answer, from the findings and its launch knowledge. Code checks every line: a grounded line must cite findings and match their names and numbers; a playbook line is launch practice and may not claim what an audience likes.

The team's decisions (cities, age band, window) are constraints. The plan is for them; it tests them and reports what it finds, and alternatives go under Worth a look.

## The path of a first message

```
Web composer ──POST /teams/:id/projects──▶ RunService.createProject
                                              │ saves project (status intake) + first chat
                                              │ saves the first message + file text as projects.inputs
                                              ▼
                                         Router (agent/router)        model or scripted
                                              │ reads title, category, mode; asks a card if unsure
                                              ▼
                                         Handoff  ──▶  FilmAgent.run (agent/launch/agent.ts)
                                                          │ no plan in this chat yet
                                                          ▼
                                                   runFilmBuild → runBuild (agent/launch/pipeline.ts)
                                                          │ read → comps → pick → ground → write → check
                                                          ▼
                                         RunService saves receipts + output (OutputStore)
                                                          │ emits output.created
                                                          ▼
Web chat (SSE /threads/:id/events) shows the trace with its findings, the message, the output line
Output page reads GET /outputs/:id and opens on the Plan tab
```

The request returns at once; the run goes on in the background and streams events. One run at a time per chat (409 otherwise).

## The pieces

Film is a configuration of the shared launch runtime in `apps/api/src/agent/launch/` (spec §3.2). `agent/launch/` holds what every category does the same way; `agent/film/` holds what is Film's own: its reading, its queries and their wording, its prompts and its templates, wired together in `film/config.ts` (`filmLaunch`). The Music agent is the second configuration. The `film/*.ts` files that share a name with a runtime file (`pipeline.ts`, `audit.ts`, `fix.ts`) are thin wrappers that keep Film's signatures.

| Piece | File | Job |
|---|---|---|
| Run service | `apps/api/src/agent/run.service.ts` | Starts runs, picks router, gate or agent, resumes a run waiting on a card, saves, streams events |
| Router | `agent/router/` | First message only: title, category, mode. Quote checked |
| Gate | `agent/gate/` | Every later message: on topic, off topic (fixed refusal) or unclear (a card) |
| Handoff | `agent/category-agents.ts` | What the agent gets: title, category, mode, `inputs`, `message`, `recent` (the newest chat lines that fit about 40 lines), `planId`, `fresh` and `memory` |
| Film agent | `agent/launch/agent.ts` (`LaunchAgent`), `film/agent.ts`, `film/config.ts` | Does the job the project started with (build, audit or fix) if the chat has no plan, unless the message plainly asks for an audit or a fix, which wins (`askedJob`); otherwise refuse, or read the follow up and pick its job |
| Brief reader | `agent/film/read.ts` | Model (or scripted) turns the brief into every field it gives, each with the words it came from |
| Researcher | `agent/launch/research.ts`, prompts in `film/research.ts` | Web search for release timing and the market, facts tied to source pages |
| Query planner | `agent/film/planner.ts`, shared checks in `launch/planner.ts` | Model (or the pack's defaults) shapes the catalog queries; code keeps only what the rules allow |
| Findings | `agent/launch/findings.ts` (audience, cities, areas), `film/findings.ts` (Film's queries) | Runs the queries, builds the brief's verdicts, turns each result into a finding and streams it |
| Writer | `agent/launch/writer.ts`, prompts and templates in `film/writer.ts` | Model (or templates) writes the sections, or an answer, from the findings |
| Line check | `agent/launch/check.ts`, Film's rules in `film/check.ts` | Every written line against spec §6.2; failures dropped and logged |
| Build pipeline | `agent/launch/pipeline.ts`, Film's sections in `film/config.ts` | The steps of a plan, comp settling, "To sharpen" and Budget split, the one question it may ask. Split into stages (`askQloo`, `writePlan`) that the audit and the fix share |
| Audit | `agent/launch/audit.ts`, `audit-verdicts.ts`, `results.ts`, `results-read.ts`, `report-writer.ts` | Reads the plan (asking for it, and for results when the launch is out), tests each belief, compares results with the plan, writes the risks and alternatives, checks every line; saves a report |
| Fix | `agent/launch/fix.ts` | Runs the audit, then writes a new plan from it; saves both. Asks whether the launch is out when nothing says |
| Brief builder | `agent/launch/brief.ts` | Audience segments, the team's cities in order, verdicts on the team's assumptions, one receipt per line |
| Follow-up reader | `agent/launch/follow-up.ts` | Reads a later message; code picks the job |
| Follow ups | `agent/launch/follow-ups.ts` | Answer (findings, writer, check), rival date check, partner brief |
| Baseline | `agent/launch/baseline.ts` | Mass-market names a named partner is scored against, as a confidence aid |
| Engine | `packages/engine` | Qloo client, tools (`findTaste`, `resolveTags`, `themeTags`, `topicMap`, `rankPlaces`, …), confidence, verdicts |
| Pack | `packages/packs/src/film` | Prompt, query catalog and defaults (`catalog.ts`), module rules, budget convention, taste words (`modules.ts`) |
| Saving | `agent/output-store.ts` | Receipts and the output (brief, plan, inputs) in one transaction |
| Presenting | `apps/api/src/outputs/present.ts` | Stored output → the `Output` the screens render (tabs, findings in Evidence, changes) |
| Exports | `apps/api/src/outputs/export.ts` | Markdown and Word from the stored plan |

## The build pipeline, step by step

Code sets the steps and their order. Each step is a `trace.step` in the chat.

1. **Read** (model, quotes checked). The reader returns format, genre, logline, country of origin, language, comps, cities, window, age bands, gender, cast, director, soundtrack, route, budget (the number is read by code from the quote), signed partners, the scope (full or narrow) and the module a narrow ask names. `checkReading` keeps a value only if its quote is in your words; "launch plan", "go-to-market" and the like always make a full plan. If you named fewer than 3 comps, the model proposes more, kept apart.
2. **Understand the request** (`launch/analyse.ts`, model). What was asked, goals, constraints, the checks a good answer must pass, and what you left unsaid but the request makes clear (a home market from a country, a genre from a logline). Inferences fill only empty fields and show on the plan as assumptions.
3. **The one question.** Only when there is still no description or genre, or no city at all after that: one text card. After it, the run plans with what it has.
4. **Find the comps** (`resolveBundle`). Your comps lead; proposals fill to 4 (5 at most). An exact name match (ignoring case and accents) counts first. Same-name matches are settled by code: the one from the brief's country, then the best known. With no exact match, code uses the closest title Qloo returned (one whose name contains or sits inside the comp's, else Qloo's top result) and the plan states the substitution. Only a search with no results at all is listed in Gaps.
5. **Choose what to ask** (`pickModules`, then the query planner). The modules come from the scope and the brief (spec §6.1); the queries from the modules (spec §4.1). The model may change the music scene, brand categories, genres, place kinds and which of your cities each query uses; code keeps only your cities, table cities for Worth a look, and short phrases. It also names up to 4 partner brands per city that could realistically say yes (Qloo ranks only those) and neighbourhoods with a centre inside the city (read from the heatmap cells already fetched, no extra call). Lookups of names are kept for 14 days across runs.
6. **Ask Qloo** (`ground`). The audience and the cities run first, in parallel (one heatmap call over your cities and up to 4 nearby ones, with leave one out). Then every phrase is resolved to a tag in one `resolveTags` run, and the other queries run. Each result becomes a finding, streamed as a `finding` event. A query that returns nothing is asked again with its narrowest filter dropped (years, then age band, then city), at most twice; a wider read is said to be one and is never above medium confidence. A query that still returns nothing, or fails, becomes a Gap; a spent budget stops the rest. A research check then judges what the findings cover for each of the request's checks and may add up to three catalog queries for a thin one (`launch/research-loop.ts`).
7. **Look up the market** (only when the writer's provider has search). `research.ts` asks the provider's web search about release timing, rivals, distributors and exhibitors, and market numbers for the genre, country and cities, never the title or story, then extracts facts each tied to a source page. A failure writes the plan without it.
8. **Write** (model, or templates with no key). The writer gets the brief, the comps and the findings, and writes every section but "To sharpen" and Budget split, which code writes. `decisions.ts` then makes sure every city and every comp the team named is answered.
9. **Check** (`checkSections`). Every line against spec §6.2. A core section left empty is filled from the templates and checked again. A line that fails goes back to the writer with its reason.
10. **Red team** (`launch/review.ts`). A model compares the request, the chat and the draft and lists issues; code decides pass or fail. A blocking issue sends the draft back, with more research when it names a query, up to three drafts.
11. **Save.** The output holds the brief (Audience and Assumptions tabs), the plan, and `inputs` (the reading and the resolved comps, so a what-if can rerun it). Each finding has a receipt with `lineId` = the finding's id, so it opens to its call.

## What decides what

| Decision | Who | Where | How |
|---|---|---|---|
| Category, mode, title | Model, checked | router | Quote must be in your words; else a card |
| Every field of the brief | Model, checked | `film/read.ts` | Quote must be in your words |
| Full plan or narrow ask, and which module | Model, then code | `film/read.ts` | Plan words always mean full |
| Comps to add | Model | `film/read.ts` | Only below 3 of yours; checked in Qloo; kept apart |
| Which same-name title a comp is | Code | `launch/pipeline.ts` `settle` | Country, then popularity |
| Which modules | Code | pack `pickModules` | Spec §6.1 |
| Which queries, and their context | Code, shaped by the model | `planner.ts` | Catalog, team cities, resolved tags |
| Every number, verdict, confidence | Code | `packages/engine`, `launch/brief.ts`, `launch/findings.ts` | Spec §5 |
| Each finding's sentence | Code | `launch/findings.ts`, `film/findings.ts` | Templates over what Qloo returned |
| The plan's wording | Model (templates with no key) | `film/writer.ts` | Checked line by line |
| To sharpen, Budget split | Code | `launch/pipeline.ts`, `film/config.ts` | Convention table in the pack |
| Every team city and comp answered, home-market premiere | Code | `launch/decisions.ts` | Backstop for what the writer missed |
| Follow-up job | Code, from the model's reading | `launch/follow-up.ts` | Rivals with dates → date; "partner" → brief; a change → what-if unless it is asked as a question; else answer |
| Refusals | Code | `REFUSALS` in `packages/packs` | Regex, fixed words, before any call |

## Where the model comes in (and where it never does)

The model is `LLM_MODEL`, role `agent` for Film. It reads the brief, shapes the queries, writes the plan, reads a follow up and writes answers and partner pitches. Every model call has a fallback (scripted reader, the pack's default queries, the template writer), used with no key or when the call fails. A plan records which wrote it (`writer`).

The model **never**: sets a number, verdict or confidence; names an entity that is in neither a finding it cites nor the brief; puts a city or age band the team did not choose in the bottom line; cites a call that does not exist; sees raw Qloo data beyond the findings.

## The numbers (all code, all in spec §5)

| Number | Formula | Bands | File |
|---|---|---|---|
| Place lift | city mean cell affinity ÷ mean of all ranked cities, same call | holds ≥1.2, weak 1.0–1.2, breaks <1.0 | `tools/rank-places.ts`, `verdicts.ts` |
| Audience index | `50 + 50 × affinity`, 0–100, 50 neutral | — | `verdicts.ts` |
| Age verdict | your band vs the top band | holds within 0.05 of top, weak >0, breaks ≤0 | `verdicts.ts` |
| Gender verdict | that gender's affinity | holds >0.05, weak ±0.05, breaks <−0.05 | `verdicts.ts` |
| Comps verdict | city order with each comp left out | holds if unchanged, weak if it rests on one | `verdicts.ts` |
| Lift (partner brief only) | candidate affinity ÷ baseline mean affinity, same call | ≥1.5 strong, 1.2–1.5 usable | `engine/scoring.ts` |
| Rival overlap | rival affinity × 100 | >85 risky, 70–85 moderate, <70 low | `scoring.ts` |
| Budget split | the pack's convention shares, times the budget when one is given | — | `film/config.ts`, pack `BUDGET_CONVENTION` |

**Confidence** (spec §5.1) is set per call and carried by each finding. A plan's confidence is the lowest of the findings behind its bottom line.

## The audit and the fix

An audit is a pipeline like the build, in `audit.ts`. Each step is a `trace.step`:

1. **Read the plan.** The first message and its files, whole (up to 40,000 characters of each file; the router and a build read the first 8,000). The brief reader pulls out cities, ages, gender, comps, partners and artists, and a results reader pulls out whether the launch is out and what it produced, each value with the words it came from, checked by code. Cities are kept in the order the plan names them. If there is nothing to test it asks for the plan; if the launch is out and there are no results it asks for them once ("skip" goes on without); a fix also asks whether the launch is out when nothing says.
2. **Find the comps, choose the queries, ask Qloo.** The same `findComps` and `askQloo` as a build, asking about the whole plan. Brands the plan names join the candidates Qloo ranks.
3. **Test each assumption** (`audit-verdicts.ts`). Spec §5.3. Fix lines are templates over the findings.
4. **Write the risks and alternatives** (model, or templates), then **check every line** (spec §6.2).
5. **Save.** An `audit` output with the report and the same brief an older output had. The report becomes the chat's base, so a message works on it.

A fix (`fix.ts`) runs these, saves the report, then asks about the cities the results add (if any) and runs the build's `writePlan` for the reordered brief, with the fixes as notes for the writer. It saves the plan with the report as its parent. Fixing a saved report reuses its reading and comps.

## Follow ups (after the chat has a plan)

`FilmAgent` loads the plan, refuses forecasts, pricing or sending with fixed words, then reads the message and lets code pick the job:

| Job | Trigger | What runs | Saves |
|---|---|---|---|
| Answer | default | The plan's findings, the writer in answer mode, the same line check. If the answer would change a decision it offers a what-if. Plans saved before findings use the older tool loop | Message only |
| What-if | any change to places, comps, ages or gender | The build from the plan's `inputs` with the change; every query reruns | `scenario` output; "What changed" compares plan lines by id; becomes the chat's plan |
| Audit | The plan is the whole ask: "audit my plan", "check my plan", "why did it fail". "Check how the plan plays in Lagos" is an answer | The audit of the plan the chat has: a saved audit is rerun with the new message (results, say); an Oraqul plan is read back as text | `audit` output |
| Fix | The plan is the whole ask: "fix this plan", "write a better plan" (also the Fix this plan button on a report). "Fix the budget in this plan" is an answer | The fix; on a saved report only the plan is new | `fix` output (and an `audit` when there was none) |
| Rival date check | rival titles with YYYY-MM-DD dates | `scoreRivals`: rivals scored against the comps | `date` output |
| Partner brief | "partner" + a name, or the first brand the plan names | An artist the plan's music findings ranked is backed by that finding; a brand or podcast is scored with `lift` against the baseline. The model drafts the pitch from findings, checked; the template is the fallback | `partner` output |

## Data and events

- **Tables** (spec §6): `outputs.plan` holds the launch plan, `outputs.brief` the audience and verdicts, `outputs.inputs` what to rerun from. `receipts` has one row per call or per line, with `lineId` set to a brief line's id or a finding's id.
- **Events** (`threadEventSchema`): `trace.step`, `finding`, `question`, `receipt`, `message`, `output.created`, `project.updated`, `run.stopped`, `error`. A `finding` is stored as a trace row and folds into the trace item.

## The web side

- The chat (`_workspace/chat/live-chat.tsx`) shows each finding under the running trace, the latest three while it runs and all of them in the folded trace.
- The output page opens on the first tab the API lists: Plan for a launch plan (`tabs-plan.tsx`). What a line rests on is a quiet number that opens the finding; call ids show only in the receipt drawer opened from Evidence.
- The chat shows the whole plan as a document (`plan-document.tsx`), and so does the plan page. Export menu: Download PDF, Download Word and Copy as Markdown, all built by the API (`GET /outputs/:id/export/:format`, `outputs/export.ts`).

## Limits and config

| Setting | Default | Meaning |
|---|---|---|
| `QLOO_MODE` | `demo` | `live` for real Qloo. Demo data is made up and every receipt says so |
| `QLOO_CALL_BUDGET` | 80 | Qloo calls per run. A live Third Bridge plan uses about 45 to 65 |
| `AGENT_MAX_STEPS` | 12 | Tool loop steps for an answer on an older plan |
| `LLM_API_KEY`, `LLM_MODEL` | empty | No key → scripted reader, default queries and the template writer |
| Qloo client | 2 in flight, 1 retry, 2 on a 429 | `packages/engine/src/qloo/client.ts` |

## Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/scoring.ts`, `verdicts.ts` or `confidence.ts` |
| What the reader pulls from a brief | `FILM_READ_SYSTEM` and `filmReadingSchema` in `film/read.ts` |
| Which queries exist, and their defaults | spec §4.1, then `packages/packs/src/film/catalog.ts` and `findings.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `film/planner.ts` |
| Which modules a plan gets | spec §6.1, then `pickModules` in `packages/packs/src/film/modules.ts` |
| A finding's sentence | `film/findings.ts` (Film's queries), `launch/findings.ts` (audience and cities) |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM` in `film/writer.ts` |
| The template wording | `templateSection` in `film/writer.ts` |
| A check rule | spec §6.2, then `launch/check.ts` (Film's words in `film/check.ts`) |
| Words a playbook line may not use | `TASTE_CLAIM` in the Film pack |
| Cities that can be ranked, their regions and countries | `engine/src/places.ts` |
| Follow-up job rules | `decideFollowUp` in `launch/follow-up.ts` |
| Tabs and Evidence rows | `apps/api/src/outputs/present.ts` |
| Expected results of the golden runs | `packages/eval/golden/film/*.json` (`UPDATE_GOLDEN=1`; `RECORD_LIVE=1` for the live one) |
