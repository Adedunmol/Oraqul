const baseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`API ${status} for ${path}`);
  }
}

export function apiUrl(path: string): URL {
  return new URL(path, baseUrl);
}

/** Turns a response into a parsed value. The 401 redirect is the caller's job, see docs/frontend/data.md. */
export async function parseResponse<T>(
  response: Response,
  path: string,
  schema: { parse(data: unknown): T },
): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, path);
  }
  return schema.parse(await response.json());
}
