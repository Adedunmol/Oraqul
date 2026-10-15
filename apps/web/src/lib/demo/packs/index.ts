import type { Category } from '@oraqul/schema';
import type { DemoPack } from '../types';
import { books } from './books';
import { film } from './film';
import { games } from './games';
import { music } from './music';
import { podcasts } from './podcasts';

export const PACKS: Record<Category, DemoPack> = { film, music, books, podcasts, games };
