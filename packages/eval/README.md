# @oraqul/eval

Evals are the proof the product works ([docs/testing.md](../../docs/testing.md)).

- `golden/<category>/*.json` (film, music, books, podcasts, games, shows): build inputs, the replies to each card the run asks, and the expected
  result (verdicts, top cities, section picks, which lines the moves cite). They run in
  `apps/api/src/agent/<category>/golden.spec.ts` on the demo Qloo data, which is committed, so they run
  on every commit. `UPDATE_GOLDEN=1 pnpm --filter @oraqul/api test golden` re-records `expect`.
- `golden/film-audit/*.json`: Film audit and fix runs, before and after launch, run by `golden-audit.spec.ts`.
- `golden/<category>/*.live.json`: the same runs over recorded live Qloo responses. Recorded with
  `RECORD_LIVE=1` and a key, and gitignored until Qloo confirms what may be republished. When a
  file is there, the golden spec replays it too.
- `live/briefs.json`: the briefs the live runs send through the real agents, as a person would write them
  (a sentence or two, few or no comps, sometimes a place and nothing else). They run with
  `pnpm --filter @oraqul/api test:live` on live Qloo and the configured models, and each plan,
  its Markdown export and the QA checker's report go to `live/out/`, which is gitignored. A brief with
  an `example` is also written as a marketing example when `RECORD_EXAMPLES=1`. See
  [docs/testing.md](../../docs/testing.md).
