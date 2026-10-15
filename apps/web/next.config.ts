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
  // A phone on the same Wi-Fi opens the dev server by LAN address. Without this Next blocks its scripts, the page never hydrates and everything that waits on <Reveal> stays hidden.
  allowedDevOrigins: ['192.168.*.*'],
  // Old addresses from before projects moved under their category. Temporary, so they can be reused.
  async redirects() {
    return [
      { source: '/projects', destination: '/categories/all/projects', permanent: false },
      { source: '/projects/:id', destination: '/categories/all/projects/:id', permanent: false },
      {
        source: '/categories/:category',
        destination: '/categories/:category/projects',
        permanent: false,
      },
    ];
  },
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
