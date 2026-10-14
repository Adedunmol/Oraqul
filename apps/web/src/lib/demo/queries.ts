import {
  type Category,
  type CompareResponse,
  type Output,
  type Project,
  planKinds,
  type Thread,
  type ThreadItem,
} from '@oraqul/schema';
import { compareBriefs } from './build-output';
import { uuidFrom } from './ids';
import { type DemoState, douts } from './store';

// One function per endpoint the screens will call once the API serves these resources
// (spec §7). Swapping the demo for the API means replacing these with fetchers in lib/api.

/** `GET /projects?category=` */
export function listProjects(s: DemoState, category?: Category): Project[] {
  return category ? s.projects.filter((p) => p.category === category) : s.projects;
}

export interface ThreadSummary {
  thread: Thread;
  outputCount: number;
  unread: boolean;
}

export interface ProjectDetail {
  project: Project;
  /** Newest first. */
  threads: ThreadSummary[];
  /** In creation order. */
  outputs: Output[];
  currentPlanId: string | null;
}

const isPlan = (o: Output): boolean => (planKinds as readonly string[]).includes(o.kind);

/** `GET /projects/:id` */
export function getProjectDetail(s: DemoState, id: string): ProjectDetail | undefined {
  const project = s.projects.find((p) => p.id === id);
  if (!project) return undefined;
  const outputs = s.outputs.filter((o) => o.projectId === id);
  const threads = s.threads
    .filter((t) => t.projectId === id)
    .reverse()
    .map((thread) => ({
      thread,
      outputCount: outputs.filter((o) => o.threadId === thread.id).length,
      unread: s.unread[thread.id] === true,
    }));
  return { project, threads, outputs, currentPlanId: outputs.filter(isPlan).at(-1)?.id ?? null };
}

export interface RecentThread {
  thread: Thread;
  project: Project;
  outputCount: number;
  unread: boolean;
  busy: boolean;
}

/** Why something is on the "Needs you" list. Ordered by how soon it needs a person. */
export type NeedReason = 'answer' | 'results' | 'ready' | 'working';

export type NeedsYouItem =
  | { reason: 'answer'; thread: Thread; project: Project; prompt: string }
  | { reason: 'ready' | 'working'; thread: Thread; project: Project }
  | { reason: 'results'; project: Project };

export interface Overview {
  needsYou: NeedsYouItem[];
  /** Newest first, at most `limit`, leaving out threads already under "Needs you". */
  threads: RecentThread[];
}

const NEED_ORDER: Record<NeedReason, number> = { answer: 0, results: 1, ready: 2, working: 3 };

// A launch that is out but has no rescue yet: its results would show who really came.
const LAUNCHED = /opened|launched|released|live/i;

/** `GET /overview` */
export function getOverview(s: DemoState, limit = 4): Overview {
  const byId = new Map(s.projects.map((p) => [p.id, p]));
  const needsYou: NeedsYouItem[] = [];
  for (const thread of s.threads) {
    const project = byId.get(thread.projectId);
    if (!project) continue;
    const items = s.items[thread.id] ?? [];
    const open = items.findLast((x) => x.role === 'question' && x.answer === null);
    if (s.busy[thread.id]) needsYou.push({ reason: 'working', thread, project });
    else if (open?.role === 'question') {
      needsYou.push({ reason: 'answer', thread, project, prompt: open.question.prompt });
    } else if (s.unread[thread.id]) needsYou.push({ reason: 'ready', thread, project });
  }
  for (const project of s.projects) {
    const rescued = s.outputs.some((o) => o.projectId === project.id && o.kind === 'rescue');
    if (LAUNCHED.test(project.status) && !rescued) needsYou.push({ reason: 'results', project });
  }
  needsYou.sort((a, b) => NEED_ORDER[a.reason] - NEED_ORDER[b.reason]);

  const listed = new Set(needsYou.flatMap((n) => ('thread' in n ? [n.thread.id] : [])));
  const threads = s.threads
    .slice()
    .reverse()
    .flatMap((thread): RecentThread[] => {
      const project = byId.get(thread.projectId);
      if (!project || listed.has(thread.id)) return [];
      return [
        {
          thread,
          project,
          outputCount: s.outputs.filter((o) => o.threadId === thread.id).length,
          unread: s.unread[thread.id] === true,
          busy: s.busy[thread.id] === true,
        },
      ];
    })
    .slice(0, limit);
  return { needsYou, threads };
}

export interface ThreadDetail {
  thread: Thread;
  project: Project;
  items: ThreadItem[];
  /** Outputs made in this thread, in creation order. */
  outputs: Output[];
  /** Every output of the project, so chat cards and "built on" can name them. */
  projectOutputs: Output[];
  busy: boolean;
}

/** `GET /threads/:id` */
export function getThreadDetail(s: DemoState, id: string): ThreadDetail | undefined {
  const thread = s.threads.find((t) => t.id === id);
  const project = thread && s.projects.find((p) => p.id === thread.projectId);
  if (!thread || !project) return undefined;
  const projectOutputs = s.outputs.filter((o) => o.projectId === project.id);
  return {
    thread,
    project,
    items: s.items[id] ?? [],
    outputs: projectOutputs.filter((o) => o.threadId === id),
    projectOutputs,
    busy: s.busy[id] === true,
  };
}

export interface OutputDetail {
  output: Output;
  project: Project;
  thread: Thread;
  /** The output it was built on: the parent plan, or the plan a date check or brief came from. */
  builtOn: Output | undefined;
}

/** `GET /outputs/:id` */
export function getOutputDetail(s: DemoState, id: string): OutputDetail | undefined {
  const output = s.outputs.find((o) => o.id === id);
  const project = output && s.projects.find((p) => p.id === output.projectId);
  const thread = output && s.threads.find((t) => t.id === output.threadId);
  if (!output || !project || !thread) return undefined;
  const builtOnId = output.parentId ?? douts.get(output.id)?.ofId ?? null;
  return { output, project, thread, builtOn: s.outputs.find((o) => o.id === builtOnId) };
}

/** Plan outputs of a project, in creation order, for lineage and compare. */
export function planOutputs(outputs: Output[]): Output[] {
  return outputs.filter(isPlan);
}

/** `GET /projects/:id/compare?a=&b=` */
export function comparePlans(a: string, b: string): CompareResponse {
  const from = douts.get(a);
  const to = douts.get(b);
  if (!from || !to) throw new Error('Both outputs must exist to compare them');
  return { a, b, changes: compareBriefs(from.brief, to.brief) };
}

export function shareTokenFor(outputId: string): string {
  return uuidFrom(`share:${outputId}`).replace(/-/g, '').slice(0, 24);
}

export function shareState(s: DemoState, outputId: string): { token: string; enabled: boolean } {
  return s.shares[outputId] ?? { token: shareTokenFor(outputId), enabled: true };
}

/** `GET /s/:token`. Undefined when no output has that token or its link is off. */
export function getShared(s: DemoState, token: string): OutputDetail | undefined {
  const output = s.outputs.find((o) => shareState(s, o.id).token === token);
  if (!output || !shareState(s, output.id).enabled) return undefined;
  return getOutputDetail(s, output.id);
}
