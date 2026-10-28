import { createHash } from 'node:crypto';
import { type AnalyseInput, type Analysis, type Analyst, analysisSchema } from './analyse.js';
import type { QueryPlanCore, QueryPlanInput, QueryPlanner } from './planner.js';
import type { LaunchRead } from './read-core.js';

/** Bump when a planner's defaults or the shape of a plan changes, so old memos are not reused. */
export const MEMO_CODE_VERSION = 'memo-1';

/**
 * A store for what the model chose for a brief, so the same brief gets the same questions.
 * Entries are advice about what to ask Qloo. They are never evidence and never cited.
 */
export interface BriefMemos {
  get(key: string): Promise<unknown | null>;
  set(key: string, kind: string, value: unknown): Promise<void>;
}

/** No memory: every run asks the model afresh. */
export class NoMemos implements BriefMemos {
  async get() {
    return null;
  }
  async set() {}
}

const words = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export const memoKey = (kind: string, version: string, input: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify([kind, MEMO_CODE_VERSION, version, input]))
    .digest('hex');

/** The analyst's reading of a brief, reused when the same request is read again. */
export class MemoizedAnalyst implements Analyst {
  constructor(
    private readonly inner: Analyst,
    private readonly memos: BriefMemos,
    private readonly version: string,
    private readonly onError: (err: unknown) => void = () => {},
  ) {}

  async analyse<R extends LaunchRead>(input: AnalyseInput<R>) {
    // The reader's output is left out: it is a model's reading and varies, and the memo pins what follows from the words.
    const key = memoKey('analysis', this.version, {
      category: input.category,
      title: input.title,
      text: words(input.text),
    });
    try {
      const hit = analysisSchema.safeParse(await this.memos.get(key));
      if (hit.success) return { analysis: hit.data as Analysis, tokens: 0 };
    } catch (err) {
      this.onError(err);
    }
    const out = await this.inner.analyse(input);
    if (out.analysis) await this.memos.set(key, 'analysis', out.analysis).catch(this.onError);
    return out;
  }
}

const looksLikePlan = (value: unknown): value is QueryPlanCore =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as QueryPlanCore).queries) &&
  Array.isArray((value as QueryPlanCore).cities) &&
  Array.isArray((value as QueryPlanCore).worthALook);

/** The query planner's choices for a brief, reused when the same brief is planned again. */
export class MemoizedQueryPlanner<R extends LaunchRead, P extends QueryPlanCore>
  implements QueryPlanner<R, P>
{
  constructor(
    private readonly inner: QueryPlanner<R, P>,
    private readonly memos: BriefMemos,
    private readonly version: string,
    private readonly onError: (err: unknown) => void = () => {},
  ) {}

  async plan(input: QueryPlanInput<R>) {
    const key = memoKey(
      'query-plan',
      this.version,
      input.text === undefined
        ? input
        : { title: input.title, text: words(input.text), modules: input.modules },
    );
    try {
      const hit = await this.memos.get(key);
      if (looksLikePlan(hit)) return { plan: hit as P, tokens: 0 };
    } catch (err) {
      this.onError(err);
    }
    const out = await this.inner.plan(input);
    await this.memos.set(key, 'query-plan', out.plan).catch(this.onError);
    return out;
  }
}
