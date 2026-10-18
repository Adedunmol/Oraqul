# @oraqul/eval

Evals are the proof the product works ([docs/testing.md](../../docs/testing.md)).

- `golden/film/*.json`: Film build inputs, the replies to each card the run asks, and the expected
  result (verdicts, top cities, section picks, which lines the moves cite). They run in
  `apps/api/src/agent/film/golden.spec.ts` on the demo Qloo data, which is committed, so they run
  on every commit. `UPDATE_GOLDEN=1 pnpm --filter @oraqul/api test golden` re-records `expect`.
- `golden/film/*.live.json`: the same runs over recorded live Qloo responses. Recorded with
  `RECORD_LIVE=1` and a key, and gitignored until Qloo confirms what may be republished. When a
  file is there, the golden spec replays it too.
