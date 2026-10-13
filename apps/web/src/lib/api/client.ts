import { apiUrl, parseResponse } from './http';

/**
 * Browser-side request for writes. A 401 sends the person to `/` and the promise never settles,
 * so callers do not flash an error while the page leaves. Sign in calls pass `redirectOn401: false`
 * because a 401 there means wrong credentials.
 */
export async function clientRequest<T>(
  path: string,
  init: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown; redirectOn401?: boolean },
  schema: { parse(data: unknown): T },
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: init.method,
    credentials: 'include',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 401 && init.redirectOn401 !== false) {
    window.location.assign('/');
    return new Promise<never>(() => {});
  }
  return parseResponse(response, path, schema);
}
