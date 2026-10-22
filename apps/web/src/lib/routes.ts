import { type Category, categories, type StartMode } from '@oraqul/schema';

/** Which projects a list shows: one category, or `all`. A category id is a fixed set, so `all` cannot clash with one. */
export type CategoryScope = Category | 'all';

/** Reads the `category` filter of the project list. No filter means every category. */
export function parseScope(value: string | undefined): CategoryScope | undefined {
  if (value === undefined || value === 'all') return 'all';
  return categories.find((c) => c === value);
}

export const overviewPath = '/overview';

/** The project list. A category is a filter on that one list, so it rides in the query. */
export function projectsPath(scope: CategoryScope = 'all'): string {
  return scope === 'all' ? '/projects' : `/projects?category=${scope}`;
}

/** The one address of a project. It opens the project's newest chat. */
export function projectPath(project: { id: string }): string {
  return `/projects/${project.id}`;
}

/** One chat of a project, with the project's workspace around it. */
export function chatPath(chatId: string): string {
  return `/chats/${chatId}`;
}

/** A saved output. `tab` opens one of its tabs. */
export function outputPath(outputId: string, tab?: string): string {
  return tab ? `/outputs/${outputId}?tab=${tab}` : `/outputs/${outputId}`;
}

/**
 * The message box for something new. `mode` is only a hint the agent starts from; without it the
 * agent reads the job from the message. Nothing is saved until the first message.
 */
export function startPath({
  mode,
  category,
}: {
  mode?: StartMode;
  category?: Category;
} = {}): string {
  const query = new URLSearchParams();
  if (mode) query.set('mode', mode);
  if (category) query.set('category', category);
  const qs = query.toString();
  return qs ? `/start?${qs}` : '/start';
}
