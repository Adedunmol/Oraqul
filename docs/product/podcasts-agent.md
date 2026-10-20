# The Podcasts launch agent

What "good" means for a Podcasts plan, and the first place to look when one disappoints. Shared rules (sources, how to use Qloo, lessons) are in [principles.md](principles.md). Behaviour and numbers are in [spec](spec.md) and [PRD](prd.md); the technical map is [podcasts-overview](../backend/podcasts-overview.md). Film, Music and Games are the models for this one: where a rule is the same, [film-agent.md](film-agent.md), [music-agent.md](music-agent.md) and [games-agent.md](games-agent.md) have the reasoning.

## What a launch plan has to settle

A plan is a set of decisions, not a document:

| Decision | What it covers |
|---|---|
| Where | The markets to lead with and in what order: where the show's listeners are strongest, and where the spend and the live work go |
| When | The release date or window, and every beat before it |
| Who | Core and secondary audience, what else they hear, watch and follow |
| What to own | The topics the show can be known for that rival shows do not own, and the topics the team wanted that it does not own alone |
| Which swaps | The shows the audience already hears, to trade trailers, ads and guests with. A show the team already has in mind is ranked beside them |
| Who pays | Sponsors that could realistically say yes to a new show, ranked for the listeners |
| How to reach them | Guests, press and newsletters, clips and video, live recordings, community |
| Cost and measures | A budget split and the numbers to track for this kind of launch |
| Risks | A market that grows slowly, a topic every rival already carries, a date that slips |

## Launch kinds and formats

A podcast is launched in one of two ways, in audio, video or both. The agent reads the kind and the format from the brief. When the brief does not say, it plans a new show in audio and says so in "To sharpen this plan".

| Kind | Sections it gets, in order | The calendar | What to track |
|---|---|---|---|
| **New show** | Cross promotion shows, Guests, Sponsors, Press and newsletters, Video and clips, Live shows, Community, Episode cadence | The cover art and the feed, an editorial pitch to Apple Podcasts and Spotify, a trailer, the swaps booked, launch with three episodes, the first weeks for follows and reviews, a first read of the month | Followers by market and age band in the first month, downloads at 7 and 30 days, completion, where new listeners came from |
| **New season** | Cross promotion shows, Sponsors, Guests, Video and clips, Press and newsletters, Live shows, Community, Episode cadence | An announcement to the current feed, a trailer, the swaps, the best earlier episodes pinned as the way in, the premiere, a read of the month against the last season | Followers added against the last season, premiere and episode downloads, how many of the last season's listeners return, where new listeners came from |

The format shapes the calendar and the sections inside a kind. Video and clips need a filmed show (or YouTube). The editorial pitch is for Apple Podcasts and Spotify. Guests are dropped for a narrative show unless guests are named. Every plan also has Markets, Launch beats, Budget split and What to measure.

## Requirements (what "done" means)

1. **Plan for the team's decisions.** Their markets, platforms, launch kind, format, age band, comparable shows, topics, swaps, sponsors and window are constraints. Test them and say what Qloo found, never replace them. A topic that rival shows carry as much as the team does, or a swap that ranks low, is said plainly, and the team's choice stays beside the stronger one. Every named market, comparable show, topic and swap gets an answer.
2. **Work with thin input.** A one-line description, such as "a Nigerian true crime podcast", is enough. Ask for nothing beyond what the show is, and never ask for comparable shows. With no market named, plan for the usual markets of a launch like this; a nationality ("for Nigerians") names the market. With no platform named, assume the format's usual platforms. End with what would sharpen the plan. A name alone gives the default launch, so the agent asks for one line about the show, and asks again if the answer says nothing.
3. **Describe the audience with shows like it, so the person need not.** Comparable shows the person names lead. Fewer than three, and the agent adds well known shows from the subject (the model proposes them; with no model, the pack has a list per subject), each labelled as added by Oraqul. A show Qloo finds by exact name leads the audience question. A new show it does not know is planned from the comparable shows, and the plan says so. A show the team named as a swap or a rival is never added as a comp.
4. **Say which topics are yours.** The topic map compares the audience with the audience of rival shows in one call. A topic only the show's side carries is yours; one both carry is shared. The team's own topics are tested against it. When the team named no rival, the comparison is with shows in the same genre, and the plan says so.
5. **Cover what Qloo cannot measure from knowledge.** When the brief says who the show is made for by language, culture or community, Qloo cannot target it and never receives it (only public entity names, place names and age bands go to Qloo). The model covers it as labelled playbook lines: the language of the feed and the description, where people there hear shows, local newsletters and communities. When search is configured, the web step also looks up how people in the named markets listen, and a line may state such a fact only with its source. The plan never claims what that audience likes without a finding, and never stereotypes.
6. **Be date-aware.** Beats are dates when the release date is known, and weeks before it when not. A beat that is already over is never advised. A date or a rival release appears only when a web source states it, with the source. If the release date has passed, the plan says there is nothing left to plan and points to an audit.
7. **Be realistic about scale.** A new independent show gets in-kind support from a brand, not sponsorship cash. Who will sponsor a show and what the audience likes are different questions, and Qloo answers only the second.
8. **Be actionable.** Each line is the move, the reason and who does it. Readable in about five minutes, short lines, plain words, no data jargon in the plan. People who hear the show are listeners.
9. **Never invent the show.** Its episodes, stories and guests come only from the brief. What the audience hears is what to speak to, never what the show contains.
10. **No forecasts.** No download, listener, chart or ad rate predictions, and no pricing advice.
11. **Be exportable and revisable.** PDF, Word and Markdown built as documents; a what-if reruns the plan, such as adding a swap, a market or a comparable show.

## What grounded means for Podcasts

- **Examples.** A plain model names the biggest shows. A grounded plan names the actual shows, brands, artists and series this audience ranks highest.
- **Swaps are ranked within one call.** Qloo scores shows against the audience in one call, so a swap the team named is scored with the rest and shows where it stands. Scores from separate calls are never compared.
- **The team's assumptions are tested.** The age band, each named market and city, and each topic are checked against Qloo's data on the comparable shows.
- **Where a chatbot beats us.** Qloo has no downloads, charts, ratings, ad rates or editorial rules, so the calendar, the editorial pitch and the guests section come from launch knowledge, labelled as such. We win on who the audience is, which topics are theirs, and what else they follow.

## How we judge a plan

Run the same brief through Oraqul and plain models, then score 1 to 5 on:

1. Answers the ask (where to lead, which shows to swap with, what to do first)
2. Uses what was given (markets, platforms, kind, format, age band, comparable shows, topics, swaps, without replacing them)
3. Specific and actionable
4. True (real names and facts only; spot-check them)
5. Knows the audience (credible, by kind of media, not generic)
6. Knows the calendar (the right beats for the kind and the platforms, with sources for dates)
7. Readable

Qloo can lift only 4 and 5. If we score lower on the rest, the cause is the model, prompt or rules, and is fixable. If we do not win 4 and 5, Qloo is not helping. The grounding report (lines that cite Qloo or a page, findings used, lines dropped, rank kept) counts citations, not whether they are right: a person still reads the plan.

## Known limits

- **Podcast signals are not verified yet.** Whether a podcast works as a signal for shows, brands, artists, series and markets, and what the comparison call returns for two groups of shows, is checked by `pnpm --filter @oraqul/engine qloo:podcasts-probes`. Until [qloo.md](../backend/qloo.md) says so, Podcasts findings from those queries carry `TODO(verify)` in the spec and the plan is not claimed to beat a chatbot on them.
- **The topic map rests on one call.** If Qloo's response for two groups of shows does not carry each side's own tags, there is no map, and the plan says no topic map was made.
- **Guests and hosts are launch practice.** Qloo may not hold them. Until the probe says it does, the Guests section is playbook, and the Assumptions tab says guests were not measured.
- **A new show is planned from its comparable shows.** If those are off, the audience is off. The plan says what it rests on.
- **Editorial and platform rules change.** They come from web research when search is configured, and are otherwise left out of the plan.
- **Markets are cities.** A region such as West Africa is ranked through the cities in Qloo's table that stand for it. A region the table does not cover is not ranked, and the plan says so.
- **Overlap is not a share of listeners.** It is how close another audience is to the show's, scored by Qloo, on a scale of 0 to 100.
- **Ambiguous names** are settled in code and the plan says which was chosen. Show names collide often. A wrong match is possible.
