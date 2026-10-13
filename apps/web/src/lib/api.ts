const baseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(new URL(path, baseUrl), { ...init, credentials: 'include' });
}
