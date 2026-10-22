import {
  type CompareResponse,
  type CreateProjectInput,
  type CreateProjectResult,
  compareResponseSchema,
  createProjectResultSchema,
  createThreadResultSchema,
  emptyResponseSchema,
  type MemoryItem,
  memoryItemSchema,
  type PinnedProjects,
  type PostMessage,
  pinnedProjectsSchema,
  type ShareState,
  shareStateSchema,
} from '@oraqul/schema';
import { clientFile, clientGet, clientRequest } from './client';

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

/** A chat on the project's memory and current plan, or `fresh`: standalone, knowing only the name. */
export async function createThread(projectId: string, fresh: boolean): Promise<string> {
  const { threadId } = await clientRequest(
    `/projects/${projectId}/threads`,
    { method: 'POST', body: { fresh } },
    createThreadResultSchema,
  );
  return threadId;
}

/** Rewrites one of the project's notes. A plan pointer is kept by the agent and cannot be edited. */
export function editMemory(projectId: string, itemId: string, text: string): Promise<MemoryItem> {
  return clientRequest(
    `/projects/${projectId}/memory/${itemId}`,
    { method: 'PUT', body: { text } },
    memoryItemSchema,
  );
}

export function forgetMemory(projectId: string, itemId: string): Promise<void> {
  return clientRequest(
    `/projects/${projectId}/memory/${itemId}`,
    { method: 'DELETE' },
    emptyResponseSchema,
  );
}

/** Turns an output's read only link on or off. The address stays the same once it exists. */
export function setShare(outputId: string, enabled: boolean): Promise<ShareState> {
  return clientRequest(
    `/outputs/${outputId}/share`,
    { method: 'PUT', body: { enabled } },
    shareStateSchema,
  );
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

/** `GET /projects/:id/compare`: the lines that differ between two of the project's plans. */
export function comparePlans(projectId: string, a: string, b: string): Promise<CompareResponse> {
  return clientGet(`/projects/${projectId}/compare?a=${a}&b=${b}`, compareResponseSchema);
}

/** A launch plan as Markdown, Word or PDF, built by the API from the stored plan. */
export function exportOutput(outputId: string, format: 'md' | 'docx' | 'pdf'): Promise<Blob> {
  return clientFile(`/outputs/${outputId}/export/${format}`);
}
