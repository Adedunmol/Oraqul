import { getMe } from './me';
import { getDefaults } from './rules-server';
import type { Viewer } from './viewer';

/** Only an owner with a verified email can save defaults, and only while the team has none. */
export async function offerTeamSetup(viewer: Viewer, returnTo: string): Promise<boolean> {
  if (viewer.role !== 'owner' || !viewer.teamId) return false;
  const [{ user }, defaults] = await Promise.all([
    getMe(returnTo),
    getDefaults(viewer.teamId, returnTo),
  ]);
  return user.emailVerified && defaults.text.trim() === '';
}
