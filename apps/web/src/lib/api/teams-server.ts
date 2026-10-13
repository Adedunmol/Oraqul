import {
  type TeamDetail,
  type TeamsResponse,
  teamDetailSchema,
  teamsResponseSchema,
} from '@oraqul/schema';
import { serverGet } from './server';

export function getTeams(returnTo: string): Promise<TeamsResponse> {
  return serverGet('/teams', teamsResponseSchema, { returnTo });
}

export function getTeam(teamId: string, returnTo: string): Promise<TeamDetail> {
  return serverGet(`/teams/${teamId}`, teamDetailSchema, { returnTo });
}
