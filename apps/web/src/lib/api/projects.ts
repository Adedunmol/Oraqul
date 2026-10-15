import {
  type CreateProjectInput,
  type CreateProjectResult,
  createProjectResultSchema,
  createThreadResultSchema,
  emptyResponseSchema,
  type PinnedProjects,
  type PostMessage,
  pinnedProjectsSchema,
} from '@oraqul/schema';
import { clientRequest } from './client';

/** Spec §9.2: the first message makes the project and its first chat. */
export function createProject(
  teamId: string,
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  return clientRequest(
    `/teams/${teamId}/projects`,
    { method: 'POST', body: input },
    createProjectResultSchema,
  );
}

export async function createThread(projectId: string): Promise<string> {
  const { threadId } = await clientRequest(
    `/projects/${projectId}/threads`,
    { method: 'POST' },
    createThreadResultSchema,
  );
  return threadId;
}

export function deleteProject(projectId: string): Promise<void> {
  return clientRequest(`/projects/${projectId}`, { method: 'DELETE' }, emptyResponseSchema);
}

/** Returns once the message is saved; the agent's reply comes on the event stream. */
export function postMessage(threadId: string, body: PostMessage): Promise<void> {
  return clientRequest(
    `/threads/${threadId}/messages`,
    { method: 'POST', body },
    emptyResponseSchema,
  );
}

export function markThreadRead(threadId: string): Promise<void> {
  return clientRequest(`/threads/${threadId}/read`, { method: 'POST' }, emptyResponseSchema);
}

export function setPinned(projectId: string, pinned: boolean): Promise<PinnedProjects> {
  return clientRequest(
    `/me/pins/${projectId}`,
    { method: pinned ? 'PUT' : 'DELETE' },
    pinnedProjectsSchema,
  );
}
