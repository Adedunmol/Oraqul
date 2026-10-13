import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// One .env at the repo root serves every app. Next has already loaded apps/web and caches that, so force a reload.
loadEnvConfig(
  new URL('../..', import.meta.url).pathname,
  process.env.NODE_ENV !== 'production',
  console,
  true,
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
