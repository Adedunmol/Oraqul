import type { Category } from '@oraqul/schema';
import { books } from './books/index';
import { film } from './film/index';
import { games } from './games/index';
import { music } from './music/index';
import { podcasts } from './podcasts/index';
import type { CategoryPack } from './types';

export type { CategoryPack } from './types';

export const packs: Record<Category, CategoryPack> = { film, music, books, podcasts, games };
export { demoProjects } from './demo';
