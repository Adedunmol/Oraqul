import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiUrl, parseResponse } from './http';

/**
 * Reads cookies, so call it inside a Suspense boundary (a loading.tsx counts) or
 * Cache Components blocks the route. A 401 sends the person to `/`, so `/` must not fetch.
 */
export async function serverGet<T>(path: string, schema: { parse(data: unknown): T }): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (response.status === 401) {
    redirect('/');
  }
  return parseResponse(response, path, schema);
}
