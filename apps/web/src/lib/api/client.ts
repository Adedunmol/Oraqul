import { ApiError, apiUrl, parseResponse } from './http';

/**
 * Browser-side request for writes. A 401 sends the person to `/sign-in` and the promise never settles,
 * so callers do not flash an error while the page leaves. Sign in calls pass `redirectOn401: false`
 * because a 401 there means wrong credentials.
 */
export async function clientRequest<T>(
  path: string,
  init: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; redirectOn401?: boolean },
  schema: { parse(data: unknown): T },
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: init.method,
    credentials: 'include',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 401 && init.redirectOn401 !== false) {
    window.location.assign('/sign-in');
    return new Promise<never>(() => {});
  }
  return parseResponse(response, path, schema);
}

/**
 * Browser-side read for data a person asks for with a click inside an open panel, such as
 * comparing two plans. Call it from the event handler, never from an effect (frontend/data.md).
 */
export async function clientGet<T>(path: string, schema: { parse(data: unknown): T }): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: 'include' });
  if (response.status === 401) {
    window.location.assign('/sign-in');
    return new Promise<never>(() => {});
  }
  return parseResponse(response, path, schema);
}

/**
 * Browser-side download of a file the person asked for with a click, such as an exported plan.
 * Fetched rather than linked, so the session cookie goes with it to the API's origin.
 */
export async function clientFile(path: string): Promise<Blob> {
  const response = await fetch(apiUrl(path), { credentials: 'include' });
  if (response.status === 401) {
    window.location.assign('/sign-in');
    return new Promise<never>(() => {});
  }
  if (!response.ok) throw new ApiError(response.status, path);
  return response.blob();
}
