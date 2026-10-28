import { defineConfig } from 'vitest/config';

// Live runs of the real agents (docs/testing.md). Not part of `pnpm test` or `pnpm test:e2e`: they
// spend Qloo calls and model tokens, so they run only when asked for.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.live-spec.ts'],
    hookTimeout: 120_000,
    testTimeout: 1_800_000,
    // One run at a time: they share Qloo's rate limit and the in-process database.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
