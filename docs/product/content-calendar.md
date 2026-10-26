# Content calendar

Every full plan has a content calendar. Code writes it from the release date and today, like the launch beats, so no row already over is advised. Every line is a playbook line that claims nothing about taste, and Oraqul makes none of the content: it is a guide for what to post. The code is `apps/api/src/agent/launch/calendar.ts`; the rows are `packages/packs/src/rules/calendar.ts`.

## What a row holds

Week or date, what to post, the kind of asset, the lead channel for the territory, and how many posts. A territory gets its own rows on its own lead channel (WhatsApp never leads). `plan.calendar` holds the rows for the table on the plan page; the section's lines carry the same rows into the exports.

A post count appears only where a source gave one. Otherwise the row says "the source gives no number", or "not researched".

## Where the rows come from

| Category | Source | Grade |
|---|---|---|
| Film | About four weeks of campaign: something new every week, something daily in the final week, the trailer as an exclusive to one big outlet first, podcasts pitched one to two weeks out, print about two months out, an online screener for reviewers who hold reviews until a few days before release | directional |
| Music | Pre-saves open at least three weeks out, teasers of 10 to 30 seconds at least three a week, content for two to three weeks either side of release day | directional |
| Books, Podcasts, Games | Not researched. The rows follow the category's launch beats (`KIND_PROFILES`) and state no counts | not-researched |
| Live shows | Derived from the show rules E1 to E5 ([shows agent](../categories/shows.md)) | directional |

Directional means one blog-level source for each point; the plan says so above the rows. The page behind each point is not recorded.

## Paid ads

Every calendar ends with one note, from an ad tool vendor, so it is directional too: about 80 percent of paid spend behind creative that has already worked and about 20 percent into testing, three to five ads in each ad group, and judge a winner by its conversion count, not by how many days it has run.

## From rows to actions

A saved plan's rows can be set up as a campaign: one action for each row, with a guide from the creative kit, that the team edits and ticks off, and optionally a two-angle test. The set belongs to that plan version, and a revised plan has its own ([spec §5.15](spec.md)). The ad conventions above are the source for the test's measure.

## Changing it

Change the rows and the version in `rules/calendar.ts`, say why in the commit, and update this file. Goldens count the calendar's lines, so read the diff before re-recording.
