import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiUrl, parseResponse } from './http';

function serverFetch(path: string): Promise<Response> {
  return cookies().then((jar) =>
    fetch(apiUrl(path), { headers: { cookie: jar.toString() }, cache: 'no-store' }),
  );
}

/**
 * Reads cookies, so call it inside a Suspense boundary (a loading.tsx counts) or
 * Cache Components blocks the route. A 401 sends the person to `/`, so `/` must not fetch.
 * Pass `returnTo` when the page should be reopened after they sign in.
 */
export async function serverGet<T>(
  path: string,
  schema: { parse(data: unknown): T },
  options?: { returnTo?: string },
): Promise<T> {
  const response = await serverFetch(path);
  if (response.status === 401) {
    redirect(options?.returnTo ? `/?next=${encodeURIComponent(options.returnTo)}` : '/');
  }
  return parseResponse(response, path, schema);
}

/**
 * For parts of a layout. A 401 gives `undefined` instead of a redirect, because the page owns the
 * redirect and knows where to return to.
 */
export async function serverGetIfSignedIn<T>(
  path: string,
  schema: { parse(data: unknown): T },
): Promise<T | undefined> {
  const response = await serverFetch(path);
  if (response.status === 401) return undefined;
  return parseResponse(response, path, schema);
}
