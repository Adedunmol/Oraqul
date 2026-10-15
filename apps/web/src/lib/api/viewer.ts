import type { Role } from '@oraqul/schema';
import { getMe } from './me';
import { getShellData } from './shell';

export interface Viewer {
  name: string;
  role: Role;
  teamName: string | null;
}

/**
 * Who is looking and what they may do on the current team. Signed out visitors are sent to sign
 * in and brought back to `returnTo`. Someone on no team can only read, as a viewer would.
 */
export async function getViewer(returnTo: string): Promise<Viewer> {
  const [{ user }, shell] = await Promise.all([getMe(returnTo), getShellData()]);
  return {
    name: user.name,
    role: shell?.team?.myRole ?? 'viewer',
    teamName: shell?.team?.team.name ?? null,
  };
}
