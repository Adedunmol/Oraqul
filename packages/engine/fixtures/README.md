# Fixtures

Recorded Qloo responses, one folder per endpoint group and one file per category type, used by
contract tests so they run offline. `pnpm --filter @oraqul/engine qloo:smoke` writes them from a
live run with our key. Each file holds the `input` sent and the `returned` body.

They are gitignored for now. Commit them only after Qloo confirms what may be republished in a
public repository (see [docs/backend/qloo.md](../../../docs/backend/qloo.md)).
See also [docs/testing.md](../../../docs/testing.md).
