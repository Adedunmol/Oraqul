import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Each file starts its own in-process Postgres and runs the migrations, which passes 10 s when
    // several files start together.
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
