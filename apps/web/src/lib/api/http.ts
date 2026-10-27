const baseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
    /** The API's machine readable reason, when it sends one, such as `email_not_verified`. */
    readonly code?: string,
  ) {
    super(`API ${status} for ${path}`);
  }
}

export function apiUrl(path: string): URL {
  return new URL(path, baseUrl);
}

/** Turns a response into a parsed value. An empty body (202, 204) parses as `undefined`. The 401 redirect is the caller's job, see docs/frontend/data.md. */
export async function parseResponse<T>(
  response: Response,
  path: string,
  schema: { parse(data: unknown): T },
): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, path, await errorCode(response));
  }
  const body = await response.text();
  return schema.parse(body === '' ? undefined : JSON.parse(body));
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'code' in body) {
      return typeof body.code === 'string' ? body.code : undefined;
    }
  } catch {
    // An error with no JSON body has no reason to read.
  }
  return undefined;
}

const EMAIL_NOT_VERIFIED = 'email_not_verified';

/** True when the API refused a write because the account's email is not confirmed yet. */
export function isEmailNotVerified(error: unknown): boolean {
  return error instanceof ApiError && error.code === EMAIL_NOT_VERIFIED;
}

export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Confirm your email first. We sent a link to your inbox, or use the banner at the top.';
