import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiUrl, parseResponse } from './http';

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
  const response = await fetch(apiUrl(path), {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (response.status === 401) {
    redirect(options?.returnTo ? `/?next=${encodeURIComponent(options.returnTo)}` : '/');
  }
  return parseResponse(response, path, schema);
}
