import { uploadResultSchema } from '@oraqul/schema';
import { ApiError, apiUrl, parseResponse } from './http';

/** A refusal the person can act on, such as a scanned PDF: the API's own sentence. */
export class UploadRefused extends Error {}

/** Sends a PDF or Word file to be read as text. The API keeps nothing. */
export async function readUpload(file: File) {
  const form = new FormData();
  form.append('file', file, file.name);
  const response = await fetch(apiUrl('/uploads'), {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (response.status === 401) {
    window.location.assign('/sign-in');
    return new Promise<never>(() => {});
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : null;
    if (response.status === 400 && message) throw new UploadRefused(message);
    throw new ApiError(response.status, '/uploads');
  }
  return parseResponse(response, '/uploads', uploadResultSchema);
}
