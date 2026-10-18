# The Film launch agent

What "good" means for a Film plan, and the first place to look when one disappoints. Shared rules (sources, how to use Qloo, lessons) are in [principles.md](principles.md). Behaviour and numbers are in [spec](spec.md), [PRD](prd.md) and [film-overview](../backend/film-overview.md).

## What a launch plan has to settle

A plan is a set of decisions, not a document:

| Decision | What it covers |
|---|---|
| Where, in what order | Markets and sequence: premiere in the home market, others within days so piracy and spoilers do not get there first |
| When | Release route and window, against rival releases and seasonal peaks |
| Who | Core and secondary audience, what each likes, where it gathers |
| How to reach them | Positioning, trailer and ad placement, publicity and creators, community and grassroots, music, brand partners |
| Cost and measures | A budget split and the numbers to track |
| Risks | Piracy, a crowded window, a thin city, a comp that leans on one title |

## Requirements (what "done" means)

1. **Plan for the team's decisions.** Their cities, age band, comps and window are constraints. Test them and say what Qloo found, never replace them. Every named city and comp gets an answer.
2. **Work with thin input.** Use everything given, ask for nothing beyond a description and one city, and end with what would sharpen the plan.
3. **Be realistic about scale.** A small film gets in-kind support, not sponsorship cash. Brand fit (what the audience likes) and ability to partner (who will say yes) are different questions. Qloo answers only the first.
4. **Be date-aware.** Windows, rivals and today's date matter. Never advise around a release that has already opened.
5. **Be actionable.** Each line is the move, the reason and who does it. Readable in about five minutes, short lines, plain words, no data jargon in the plan.
6. **Never invent the film.** Its plot, characters, themes and tone come only from the brief. The audience's themes are what to speak to, never what the film contains.
7. **No forecasts.** No box office or sales predictions.
8. **Be exportable and revisable.** PDF, Word and Markdown built as documents; a what-if reruns the plan.

## What grounded means for Film

- **Examples.** A plain model gives Afrobeats, churches and student societies. A grounded plan names the actual artists, series, venues and churches this audience ranks highest in each city.
- **The team's assumptions are tested.** On Third Bridge the comps' audience skewed 35 to 54 against an 18 to 34 target. The plan said so and kept the target.
- **Where a chatbot beats us.** Some local knowledge: Claude named Peckham, Croydon, Sugar Land, Stonecrest and Morehouse, which Qloo's place lists do not give. Neighbourhood findings from the heatmap now narrow this.

## How we judge a plan

Run the same brief through Oraqul and plain models, then score 1 to 5 on:

1. Answers the ask (where and in what order, and why)
2. Uses what was given (cities, age band, comps, without replacing them)
3. Specific and actionable
4. True (real names and facts only; spot-check them)
5. Knows the audience (credible, per city, not generic)
6. Knows the market (window, rivals, distributors, with sources)
7. Readable

Qloo can lift only 4 and 5. If we score lower on the rest, the cause is the model, prompt or rules, and is fixable. If we do not win 4 and 5, Qloo is not helping.

Also tracked in code: the **grounding report** (`apps/api/src/agent/launch/grounding-report.ts`): lines that cite Qloo or a page, findings used, lines dropped, a floor of 3 Qloo-backed lines for every chosen city in the live golden run, and **rank kept**: of the pairs of names a line takes from one Qloo list, the share written in Qloo's order (100 means the plan never put a lower-ranked pick ahead of a higher one). It counts citations, not whether they are right: a person still reads the plan.

## Known limits

- **Neighbourhood readings are a lead.** The model names the centre, code checks it against the city's box, and the cells are coarse (about 3 to 7 km). With few cells near a centre there is no reading. Confirm on the ground before booking a venue.
- **Web research can find nothing for a city**, especially US diaspora cinema. The plan then says nothing about it.
- **Web facts can be stale or off-topic.** Check dates before acting on a rival or a window.
- **Qloo's place lists carry poor fits** (a theology school or an arena among universities). Partner brands are ranked from a candidate list we choose; places are not.
- **Ambiguous names** are settled in code (country, then popularity) and the plan says which was chosen. A wrong match is possible.
- **Plans run long and stack footnotes.** The writer aims for about 1,200 words.
- **Cultural sensitivity.** Real traditions, institutions and neighbourhoods need care in anything the plan puts on screen or in a campaign.
