import { type SavedDefaults, savedDefaultsSchema } from '@oraqul/schema';
import { clientRequest } from './client';

/** Saves what the team wrote. The rules it holds are the ones every later run follows. */
export function saveDefaults(teamId: string, text: string): Promise<SavedDefaults> {
  return clientRequest(
    `/teams/${teamId}/rules`,
    { method: 'PUT', body: { text } },
    savedDefaultsSchema,
  );
}
