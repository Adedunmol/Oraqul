import { defineConfig } from 'vitest/config';

// Only the pure helpers are unit tested here; the screens are covered by Playwright (e2e/).
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
