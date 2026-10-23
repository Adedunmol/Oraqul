import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// One .env at the repo root serves every app. Next has already loaded apps/web and caches that, so force a reload.
// fileURLToPath, not URL.pathname: on Windows pathname is "/C:/..." and the root .env is silently skipped.
loadEnvConfig(
  fileURLToPath(new URL('../..', import.meta.url)),
  process.env.NODE_ENV !== 'production',
  console,
  true,
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  // A phone on the same Wi-Fi opens the dev server by LAN address. Without this Next blocks its scripts, the page never hydrates and everything that waits on <Reveal> stays hidden.
  allowedDevOrigins: ['192.168.*.*'],
  // Old addresses, from when projects lived under their category and chats were called threads.
  // Temporary, so they can be reused.
  async redirects() {
    return [
      { source: '/categories/all/projects', destination: '/projects', permanent: false },
      {
        source: '/categories/:category/projects',
        destination: '/projects?category=:category',
        permanent: false,
      },
      {
        source: '/categories/:category/projects/:id',
        destination: '/projects/:id',
        permanent: false,
      },
      { source: '/categories/all', destination: '/projects', permanent: false },
      {
        source: '/categories/:category',
        destination: '/projects?category=:category',
        permanent: false,
      },
      { source: '/threads/:id', destination: '/chats/:id', permanent: false },
    ];
  },
  partialPrefetching: true,
  experimental: {
    agentUpgrade: 'security',
  },
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
