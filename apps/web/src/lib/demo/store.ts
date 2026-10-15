import type { Output, Project, Thread, ThreadItem } from '@oraqul/schema';
import { buildOutput, type DOutput, isPlanKind } from './build-output';

// The demo backend's state. It lives in module memory: it survives client navigation and resets
// on a full reload, which is the "session only" behaviour asked for. Delete this folder once the
// API serves projects, threads and outputs; screens read it only through lib/demo/queries.ts.

export interface DemoState {
  /** Newest first, as `GET /projects` returns them. */
  projects: Project[];
  threads: Thread[];
  /** In creation order. */
  outputs: Output[];
  items: Record<string, ThreadItem[]>;
  busy: Record<string, boolean>;
  unread: Record<string, boolean>;
  shares: Record<string, { token: string; enabled: boolean }>;
}

let state: DemoState = {
  projects: [],
  threads: [],
  outputs: [],
  items: {},
  busy: {},
  unread: {},
  shares: {},
};

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getState = (): DemoState => state;

function commit(next: DemoState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Internal outputs, kept for scenarios and compares, which work on the unserialised brief. */
export const douts = new Map<string, DOutput>();

export function insertProject(project: Project): void {
  commit({ ...state, projects: [project, ...state.projects] });
}

export function patchProject(id: string, patch: Partial<Omit<Project, 'id'>>): void {
  commit({
    ...state,
    projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function removeProject(id: string): void {
  const threadIds = new Set(state.threads.filter((t) => t.projectId === id).map((t) => t.id));
  for (const o of state.outputs) if (o.projectId === id) douts.delete(o.id);
  commit({
    ...state,
    projects: state.projects.filter((p) => p.id !== id),
    threads: state.threads.filter((t) => !threadIds.has(t.id)),
    outputs: state.outputs.filter((o) => o.projectId !== id),
  });
}

export function insertThread(thread: Thread): void {
  commit({
    ...state,
    threads: [...state.threads, thread],
    items: { ...state.items, [thread.id]: [] },
  });
}

export function patchThread(id: string, patch: Partial<Omit<Thread, 'id'>>): void {
  commit({
    ...state,
    threads: state.threads.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  });
}

export function pushItem(threadId: string, item: ThreadItem): void {
  commit({
    ...state,
    items: { ...state.items, [threadId]: [...(state.items[threadId] ?? []), item] },
    unread: { ...state.unread, [threadId]: true },
  });
}

export function patchItem(
  threadId: string,
  itemId: string,
  update: (item: ThreadItem) => ThreadItem,
): void {
  commit({
    ...state,
    items: {
      ...state.items,
      [threadId]: (state.items[threadId] ?? []).map((x) => (x.id === itemId ? update(x) : x)),
    },
  });
}

export function setBusy(threadId: string, busy: boolean): void {
  commit({ ...state, busy: { ...state.busy, [threadId]: busy } });
}

export function markRead(threadId: string): void {
  if (!state.unread[threadId]) return;
  commit({ ...state, unread: { ...state.unread, [threadId]: false } });
}

export function setShare(outputId: string, token: string, enabled: boolean): void {
  commit({ ...state, shares: { ...state.shares, [outputId]: { token, enabled } } });
}

/** Saves an output, moves the thread's base forward for plans, and touches the project. */
export function insertOutput(o: DOutput): Output {
  const project = state.projects.find((p) => p.id === o.projectId);
  if (!project) throw new Error(`No project ${o.projectId} for output ${o.id}`);
  douts.set(o.id, o);
  const siblings = state.outputs
    .filter((x) => x.projectId === o.projectId)
    .map((x) => douts.get(x.id))
    .filter((x): x is DOutput => x !== undefined);
  const output = buildOutput(project, o, [...siblings, o]);
  commit({
    ...state,
    outputs: [...state.outputs, output],
    projects: state.projects.map((p) => (p.id === o.projectId ? { ...p, updatedAt: o.at } : p)),
    threads: isPlanKind(o.kind)
      ? state.threads.map((t) => (t.id === o.threadId ? { ...t, baseOutputId: o.id } : t))
      : state.threads,
  });
  return output;
}
