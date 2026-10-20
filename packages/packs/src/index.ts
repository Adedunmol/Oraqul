import type { Category } from '@oraqul/schema';
import { books } from './books/index';
import { film } from './film/index';
import { games } from './games/index';
import { music } from './music/index';
import { podcasts } from './podcasts/index';
import type { CategoryPack } from './types';

export { agentSystemPrompt, BASE_PROMPT, REFUSALS, refusalFor } from './base-prompt';
export type { CategoryPack } from './types';

export const packs: Record<Category, CategoryPack> = { film, music, books, podcasts, games };
export { demoProjects } from './demo';
export * as filmPlan from './film/plan';
export * as gamesPlan from './games/plan';
export * as musicPlan from './music/plan';
export * as podcastsPlan from './podcasts/plan';
