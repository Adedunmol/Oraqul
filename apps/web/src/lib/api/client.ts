import { apiUrl, parseResponse } from './http';

/** Browser-side request for writes. A 401 sends the person to `/`. */
export async function clientRequest<T>(
  path: string,
  init: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
  schema: { parse(data: unknown): T },
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: init.method,
    credentials: 'include',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 401) {
    window.location.assign('/');
  }
  return parseResponse(response, path, schema);
}
