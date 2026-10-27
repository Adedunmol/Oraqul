import { type TeamDefaults, teamDefaultsSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getDefaults(teamId: string, returnTo: string): Promise<TeamDefaults> {
  return serverGet(`/teams/${teamId}/rules`, teamDefaultsSchema, { returnTo });
}
