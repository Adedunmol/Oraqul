import {
  type CompareResponse,
  type Output,
  type Project,
  planKinds,
  type Thread,
  type ThreadItem,
} from '@oraqul/schema';
import { compareBriefs } from './build-output';
import { PACKS } from './packs';
import { type DemoState, douts } from './store';

// One function per endpoint the output screens still read from the demo (spec §7). Projects,
// chats, the overview and pins have moved to lib/api; outputs and share links follow.

const isPlan = (o: Output): boolean => (planKinds as readonly string[]).includes(o.kind);

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

export interface NextStep {
  /** `scn:<scenario id>`, `results`, `partner` or `date`. */
  id: string;
  label: string;
}

/**
 * Up to three things worth doing next, from the plan the thread works on and what the project
 * already has: a scenario not yet tried, results if none are in, a brief or a date check.
 */
export function getNextSteps(s: DemoState, threadId: string): NextStep[] {
  const thread = s.threads.find((t) => t.id === threadId);
  const project = thread && s.projects.find((p) => p.id === thread.projectId);
  if (!thread || !project) return [];
  const outputs = s.outputs.filter((o) => o.projectId === project.id);
  // The same fallback as the agent: the thread's plan, else the project's latest.
  const baseId = thread.baseOutputId ?? outputs.filter(isPlan).at(-1)?.id;
  const base = baseId ? douts.get(baseId) : undefined;
  if (!base) return [];
  const pk = PACKS[project.category];
  const tried = new Set(outputs.filter((o) => o.kind === 'scenario').map((o) => o.title));
  const steps: NextStep[] = [];
  const scenario = pk.scen.find((x) => !tried.has(`Scenario: ${x.label}`));
  if (scenario) {
    const label = `${scenario.label.charAt(0).toLowerCase()}${scenario.label.slice(1)}`;
    steps.push({ id: `scn:${scenario.id}`, label: `What if ${label}?` });
  }
  if (!base.brief.course) steps.push({ id: 'results', label: pk.quick[1] });
  if (!outputs.some((o) => o.kind === 'partner')) steps.push({ id: 'partner', label: pk.quick[2] });
  if (!outputs.some((o) => o.kind === 'date')) steps.push({ id: 'date', label: pk.quick[0] });
  return steps.slice(0, 3);
}

export interface OutputDetail {
  output: Output;
  project: Project;
  thread: Thread;
  /** The output it was built on: the parent plan, or the plan a date check or brief came from. */
  builtOn: Output | null;
  /** Demo outputs have no share link. */
  share: null;
  /** Demo outputs cannot be rated. */
  reaction: null;
}

/** `GET /outputs/:id` */
export function getOutputDetail(s: DemoState, id: string): OutputDetail | undefined {
  const output = s.outputs.find((o) => o.id === id);
  const project = output && s.projects.find((p) => p.id === output.projectId);
  const thread = output && s.threads.find((t) => t.id === output.threadId);
  if (!output || !project || !thread) return undefined;
  const builtOnId = output.parentId ?? douts.get(output.id)?.ofId ?? null;
  return {
    output,
    project,
    thread,
    builtOn: s.outputs.find((o) => o.id === builtOnId) ?? null,
    share: null,
    reaction: null,
  };
}

/** `GET /projects/:id/compare?a=&b=` */
export function comparePlans(a: string, b: string): CompareResponse {
  const from = douts.get(a);
  const to = douts.get(b);
  if (!from || !to) throw new Error('Both outputs must exist to compare them');
  return { a, b, changes: compareBriefs(from.brief, to.brief) };
}
