import { type TeamRulesResponse, teamRulesResponseSchema } from '@oraqul/schema';
import { serverGet } from './server';

export function getRules(teamId: string, returnTo: string): Promise<TeamRulesResponse> {
  return serverGet(`/teams/${teamId}/rules`, teamRulesResponseSchema, { returnTo });
}
