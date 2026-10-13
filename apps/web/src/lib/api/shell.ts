import { meResponseSchema, teamDetailSchema, teamsResponseSchema } from '@oraqul/schema';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { CURRENT_TEAM_COOKIE, pickTeam } from '../current-team';
import { serverGetIfSignedIn } from './server';

/**
 * What the sidebar shows, fetched once per request however many parts ask.
 *
 * The sidebar is not worth a broken page, so a failure gives `undefined` and the sidebar parts
 * render nothing. The page itself still reports an API that is down.
 */
export const getShellData = cache(async () => {
  try {
    const remembered = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value;
    const [me, list] = await Promise.all([
      serverGetIfSignedIn('/auth/me', meResponseSchema),
      serverGetIfSignedIn('/teams', teamsResponseSchema),
    ]);
    if (!me || !list) return undefined;
    const chosen = pickTeam(list.teams, remembered);
    const team = chosen
      ? await serverGetIfSignedIn(`/teams/${chosen.id}`, teamDetailSchema)
      : undefined;
    return { user: me.user, teams: list.teams, team };
  } catch {
    return undefined;
  }
});
