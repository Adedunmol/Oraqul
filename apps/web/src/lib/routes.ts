import { type Category, categories, type StartMode } from '@oraqul/schema';

/** Which projects a list shows: one category, or `all`. A category id is a fixed set, so `all` cannot clash with one. */
export type CategoryScope = Category | 'all';

export function parseScope(value: string): CategoryScope | undefined {
  if (value === 'all') return 'all';
  return categories.find((c) => c === value);
}

export const overviewPath = '/overview';

export function projectsPath(scope: CategoryScope = 'all'): string {
  return `/categories/${scope}/projects`;
}

/** The one canonical address of a project: under its own category, never under `all`. */
export function projectPath(project: { id: string; category: Category }): string {
  return `${projectsPath(project.category)}/${project.id}`;
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
