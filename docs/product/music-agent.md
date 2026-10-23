# The Music launch agent

What "good" means for a Music plan, and the first place to look when one disappoints. Shared rules (sources, how to use Qloo, lessons) are in [principles.md](principles.md). Behaviour and numbers are in [spec](spec.md) and [PRD](prd.md); the technical map is [music-overview](../backend/music-overview.md). The Film agent is the model for this one: where a rule is the same, [film-agent.md](film-agent.md) has the reasoning.

## What a launch plan has to settle

A plan is a set of decisions, not a document:

| Decision | What it covers |
|---|---|
| Where, in what order | The cities and the order the artist plays them: where the audience is strongest, and whether the order starts strong |
| When | Release date or tour window, against rival releases and seasonal peaks |
| Who | Core and secondary audience, what each plays and watches, where it gathers |
| Who opens | Support acts for each tour city, from the artists that city's audience plays |
| How to reach them | Press, podcasts and playlists, creators and short video, sync (series and films the audience watches), campuses and neighbourhoods, brand partners |
| Cost and measures | A budget split and the numbers to track |
| Risks | A tour order that starts weak, a thin city, a support act that leans on one sound-alike, an artist Qloo does not know yet |

## Requirements (what "done" means)

1. **Plan for the team's decisions.** Their cities, the order they set, age band, sound-alike artists and window are constraints. Test them and say what Qloo found, never replace them. The tour order is scored against the strongest order and the plan says so, but it keeps the team's order and offers the other beside it. Every named city and sound-alike gets an answer. An act featured on the release or tour is part of what the team told us about the audience: it anchors the read like a sound-alike and is tested like a support act.
2. **Work with thin input.** Use everything given, ask for nothing beyond what is being released and one city, and end with what would sharpen the plan.
3. **Know whether Qloo knows the artist.** An artist Qloo finds by exact name leads the audience question. A debut it does not know is planned from the sound-alike artists named, and the plan says that is what it rests on. With neither, the genre's audience stands in and the line says so.
4. **Be realistic about scale.** An independent artist gets in-kind support, not sponsorship cash. Brand fit (what the audience likes) and ability to partner (who will say yes) are different questions, and so are a support act the audience plays and one who is free and willing. Qloo answers only the first of each pair.
5. **Be date-aware.** Windows, rival releases and today's date matter. Never advise around a release that has already come out.
6. **Be actionable.** Each line is the move, the reason and who does it. Readable in about five minutes, short lines, plain words, no data jargon in the plan.
7. **Never invent the music.** Its sound, lyrics, themes, collaborators and story come only from the brief. What the audience plays is what to speak to, never what the record contains.
8. **No forecasts.** No stream, chart or ticket predictions, and no pricing advice.
9. **Be exportable and revisable.** PDF, Word and Markdown built as documents; a what-if reruns the plan.

## What grounded means for Music

- **Examples.** A plain model names the biggest artists, the biggest playlists and the biggest brands. A grounded plan names the actual support acts, podcasts, series and campuses this audience ranks highest in each city.
- **The team's assumptions are tested.** The age band, each city and the tour order are checked against Qloo. A plan that starts the tour in a city that ranks last is told so, and keeps the team's order with the stronger one beside it.
- **Where a chatbot beats us.** Qloo has no venues, promoters, radio, playlists or ticket prices, so booking, routing and the playlist game come from launch knowledge, labelled as such. We win on who the audience is and what it plays in each city, not on logistics.

## How we judge a plan

Run the same brief through Oraqul and plain models, then score 1 to 5 on:

1. Answers the ask (where, in what order, and why)
2. Uses what was given (cities, order, age band, sound-alikes, without replacing them)
3. Specific and actionable
4. True (real names and facts only; spot-check them)
5. Knows the audience (credible, per city, not generic)
6. Knows the market (window, rivals, with sources)
7. Readable

Qloo can lift only 4 and 5. If we score lower on the rest, the cause is the model, prompt or rules, and is fixable. If we do not win 4 and 5, Qloo is not helping. The grounding report (lines that cite Qloo or a page, findings used, lines dropped, rank kept) counts citations, not whether they are right: a person still reads the plan.

## Known limits

- **Artist signals are verified on one brief.** An artist works as a signal for support acts, series, films, brands, podcasts and campuses (an Afrobeats artist, 2026-10-20, [qloo.md](../backend/qloo.md)). Other genres and markets are not checked. Series for African cities lean on American shows, so those lines are leads, not facts about the city.
- **A debut is planned from its sound-alikes.** If those are off, the audience is off. The plan says what it rests on, and the sound-alikes test shows when one title carries the result.
- **No venues, promoters, radio or playlists.** Qloo does not rank them, so the plan gives practice, not names, and does not claim a venue fits.
- **The strongest order is not a routing.** The route score orders cities by audience strength, not by travel, venue availability or dates.
- **Support acts are who the audience plays**, not who is available or affordable. The plan ranks in Qloo's order and leaves booking to the team.
- **Neighbourhood readings are a lead.** The cells are coarse (about 3 to 7 km). Confirm on the ground.
- **Web research can find nothing for a city**, and what it finds can be stale. Check dates before acting on a rival or a window.
- **Ambiguous names** are settled in code (country, then popularity) and the plan says which was chosen. Artist names collide often. A wrong match is possible.
- **Cultural sensitivity.** Real scenes, institutions and neighbourhoods need care in anything the plan puts on screen or in a campaign.


## Launch rules

Rules and thresholds: [launch-rules.md](launch-rules.md). For Music:

* **Calendar.** A rollout of 6 to 8 weeks, worked back from the release date in code: delivery and playlist pitches 8 weeks out, pre-save at 6, press at 4, the video at 2, then follow-through for four weeks.
* **Signal.** Save rate and stream completion. Followers, views and playlist adds are secondary.
* **Channels.** TikTok, Reels and Shorts lead; Nigeria leads on WhatsApp and Instagram.
* **Territories.** One plan per tour city, the home market first, then the diaspora cities, beside the tour route.
