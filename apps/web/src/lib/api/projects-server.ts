import {
  type CampaignState,
  campaignStateSchema,
  type OutputDetail,
  type Overview,
  outputDetailSchema,
  overviewSchema,
  type PinnedProjects,
  type Project,
  type ProjectDetail,
  pinnedProjectsSchema,
  projectDetailSchema,
  projectListSchema,
  type ThreadDetail,
  threadDetailSchema,
  type WatchState,
  watchStateSchema,
} from '@oraqul/schema';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { CategoryScope } from '../routes';
import { ApiError, apiUrl, parseResponse } from './http';
import { serverGet, serverGetIfSignedIn } from './server';

// A project or thread the person cannot open answers 403, the same as one that does not exist
// (spec §7), so both show the not found page rather than an error to retry.
async function orNotFound<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
}

export function getProjects(
  teamId: string,
  scope: CategoryScope,
  returnTo: string,
): Promise<Project[]> {
  return serverGet(`/teams/${teamId}/projects?category=${scope}`, projectListSchema, { returnTo });
}

export function getProjectDetail(projectId: string, returnTo: string): Promise<ProjectDetail> {
  return orNotFound(serverGet(`/projects/${projectId}`, projectDetailSchema, { returnTo }));
}

export function getThreadDetail(threadId: string, returnTo: string): Promise<ThreadDetail> {
  return orNotFound(serverGet(`/threads/${threadId}`, threadDetailSchema, { returnTo }));
}

export function getCampaign(outputId: string, returnTo: string): Promise<CampaignState> {
  return orNotFound(serverGet(`/outputs/${outputId}/campaign`, campaignStateSchema, { returnTo }));
}

export function getWatch(outputId: string, returnTo: string): Promise<WatchState> {
  return orNotFound(serverGet(`/outputs/${outputId}/watch`, watchStateSchema, { returnTo }));
}

export function getOutputDetail(outputId: string, returnTo: string): Promise<OutputDetail> {
  return orNotFound(serverGet(`/outputs/${outputId}`, outputDetailSchema, { returnTo }));
}

/**
 * A shared output for someone with the link. No session: the cookie is not sent, and a link that
 * is wrong or turned off is null.
 */
export async function getSharedOutput(token: string): Promise<OutputDetail | null> {
  const path = `/s/${encodeURIComponent(token)}`;
  const response = await fetch(apiUrl(path), { cache: 'no-store' });
  if (response.status === 404) return null;
  return parseResponse(response, path, outputDetailSchema);
}

export function getOverview(teamId: string, returnTo: string): Promise<Overview> {
  return serverGet(`/teams/${teamId}/overview`, overviewSchema, { returnTo });
}

export function getPins(returnTo: string): Promise<PinnedProjects> {
  return serverGet('/me/pins', pinnedProjectsSchema, { returnTo });
}

/**
 * For the sidebar and the search palette, once per request however many parts ask. Never breaks
 * the page: undefined when signed out or the API is down.
 */
export const getSidebarProjects = cache(async (teamId: string) => {
  try {
    const [projects, pins, overview] = await Promise.all([
      serverGetIfSignedIn(`/teams/${teamId}/projects?category=all`, projectListSchema),
      serverGetIfSignedIn('/me/pins', pinnedProjectsSchema),
      serverGetIfSignedIn(`/teams/${teamId}/overview`, overviewSchema),
    ]);
    if (!projects || !pins || !overview) return undefined;
    return { projects, pins, needsYou: overview.needsYou.length };
  } catch {
    return undefined;
  }
});
