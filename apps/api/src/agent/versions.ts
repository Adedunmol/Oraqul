import { createHash } from 'node:crypto';
import { QUERY_PLAN_SYSTEM as BOOKS_QUERY_PLAN } from './books/planner.js';
import { BOOKS_READ_SYSTEM } from './books/read.js';
import {
  ANSWER_WRITER_SYSTEM as BOOKS_ANSWER,
  PLAN_WRITER_SYSTEM as BOOKS_PLAN,
} from './books/writer.js';
import { QUERY_PLAN_SYSTEM as FILM_QUERY_PLAN } from './film/planner.js';
import { FILM_READ_SYSTEM } from './film/read.js';
import {
  ANSWER_WRITER_SYSTEM as FILM_ANSWER,
  PLAN_WRITER_SYSTEM as FILM_PLAN,
} from './film/writer.js';
import { QUERY_PLAN_SYSTEM as GAMES_QUERY_PLAN } from './games/planner.js';
import { GAMES_READ_SYSTEM } from './games/read.js';
import {
  ANSWER_WRITER_SYSTEM as GAMES_ANSWER,
  PLAN_WRITER_SYSTEM as GAMES_PLAN,
} from './games/writer.js';
import { ANALYST_SYSTEM } from './launch/analyse.js';
import { RESEARCH_SYSTEM } from './launch/research-loop.js';
import { REVIEW_SYSTEM } from './launch/review.js';
import { QUERY_PLAN_SYSTEM as MUSIC_QUERY_PLAN } from './music/planner.js';
import { MUSIC_READ_SYSTEM } from './music/read.js';
import {
  ANSWER_WRITER_SYSTEM as MUSIC_ANSWER,
  PLAN_WRITER_SYSTEM as MUSIC_PLAN,
} from './music/writer.js';
import { QUERY_PLAN_SYSTEM as PODCASTS_QUERY_PLAN } from './podcasts/planner.js';
import { PODCASTS_READ_SYSTEM } from './podcasts/read.js';
import {
  ANSWER_WRITER_SYSTEM as PODCASTS_ANSWER,
  PLAN_WRITER_SYSTEM as PODCASTS_PLAN,
} from './podcasts/writer.js';

export const VERSIONS = Symbol('VERSIONS');

/** What a saved plan was made with, so a drop in quality can be pinned and two plans compared fairly. */
export interface Versions {
  /** The model that wrote the plan, or null when the template writer ran. */
  writerModel: string | null;
  /** `demo` when Qloo's answers were the committed demo data, else the host the calls went to. */
  qlooHost: string;
  /** A hash of the prompts the pipeline sends: it changes whenever any of them is edited. */
  promptVersion: string;
  /** The commit the server was built from (`CODE_VERSION`), or `dev`. */
  codeVersion: string;
}

const PROMPTS = [
  ANALYST_SYSTEM,
  RESEARCH_SYSTEM,
  REVIEW_SYSTEM,
  FILM_READ_SYSTEM,
  FILM_QUERY_PLAN,
  FILM_PLAN,
  FILM_ANSWER,
  MUSIC_READ_SYSTEM,
  MUSIC_QUERY_PLAN,
  MUSIC_PLAN,
  MUSIC_ANSWER,
  BOOKS_READ_SYSTEM,
  BOOKS_QUERY_PLAN,
  BOOKS_PLAN,
  BOOKS_ANSWER,
  PODCASTS_READ_SYSTEM,
  PODCASTS_QUERY_PLAN,
  PODCASTS_PLAN,
  PODCASTS_ANSWER,
  GAMES_READ_SYSTEM,
  GAMES_QUERY_PLAN,
  GAMES_PLAN,
  GAMES_ANSWER,
];

/** Eight hex characters of a hash of every system prompt above. */
export const promptVersion = createHash('sha256')
  .update(PROMPTS.join('\n---\n'))
  .digest('hex')
  .slice(0, 8);

interface VersionEnv {
  writerModel: string;
  qlooMode: 'demo' | 'live';
  qlooBaseUrl: string;
  codeVersion: string;
}

export function versionsOf(env: VersionEnv): Versions {
  const host = (() => {
    try {
      return new URL(env.qlooBaseUrl).host;
    } catch {
      return env.qlooBaseUrl || 'unknown';
    }
  })();
  return {
    writerModel: env.writerModel || null,
    qlooHost: env.qlooMode === 'demo' ? 'demo' : host,
    promptVersion,
    codeVersion: env.codeVersion || 'dev',
  };
}
