export const CURRENT_TEAM_COOKIE = 'oraqul_team';

/** The remembered team if the person is still on it, else their first. The cookie is only a hint. */
export function pickTeam<T extends { id: string }>(
  teams: T[],
  id: string | undefined,
): T | undefined {
  return teams.find((team) => team.id === id) ?? teams[0];
}

/** Browser only. Not httpOnly on purpose: it is a preference, and the server checks it against memberships. */
export function setCurrentTeam(id: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: callers refresh right after, so it must be synchronous; the Cookie Store API is async
  document.cookie = `${CURRENT_TEAM_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}
