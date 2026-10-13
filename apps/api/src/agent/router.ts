import type { Answer, Category, Job, ProjectInput, Question, StartMode } from '@oraqul/schema';

export const ROUTER_QUESTION_ID = 'router.confirm';

export type RouteDecision =
  | { kind: 'route'; category: Category; job: Job }
  | { kind: 'ask'; question: Question };

const jobForMode: Record<StartMode, Job> = { start: 'plan', audit: 'audit', rescue: 'rescue' };

const readings: { id: StartMode; label: string }[] = [
  { id: 'start', label: 'A new plan' },
  { id: 'audit', label: 'Check an existing plan' },
  { id: 'rescue', label: 'Fix something that went wrong' },
];

/**
 * Spec §3.1. No tools and no model: the category comes from the project and the job from the
 * start card, then the user confirms the reading (spec §9.2). A model router is for a later pass.
 */
export function route(project: ProjectInput, mode: StartMode, answers: Answer[]): RouteDecision {
  const answer = answers.find((a) => a.questionId === ROUTER_QUESTION_ID);
  if (!answer) {
    return {
      kind: 'ask',
      question: {
        id: ROUTER_QUESTION_ID,
        card: 'confirm',
        prompt: `I read this as: ${labelFor(mode).toLowerCase()} for ${project.name}. Is that right?`,
        options: [{ id: mode, label: 'Yes' }, ...readings.filter((r) => r.id !== mode)],
      },
    };
  }
  const chosen = answer.kind === 'options' ? answer.optionIds[0] : undefined;
  const confirmed = readings.find((r) => r.id === chosen)?.id ?? mode;
  return { kind: 'route', category: project.category, job: jobForMode[confirmed] };
}

function labelFor(mode: StartMode): string {
  return readings.find((r) => r.id === mode)?.label ?? mode;
}
