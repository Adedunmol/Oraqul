import type { Category } from '@oraqul/schema';
import type { Beat } from '../launch';

/** Where a rule comes from. A team rule is Oraqul's own launch craft, dated when it was set. */
export interface RuleSource {
  kind: 'team' | 'url';
  label: string;
  url?: string;
  /** `YYYY-MM-DD`, the day the rule was written or checked. */
  date: string;
}

export interface Rule<T> {
  id: string;
  value: T;
  source: RuleSource;
}

/** A number the team can aim at. It is a goal, never a forecast of what will happen. */
export interface Benchmark {
  value: number;
  floor: number | null;
  unit: string;
}

export interface SignalRule {
  /** Short key, stable across versions. */
  key: string;
  /** The one thing the plan is judged on. */
  primary: string;
  /** What is tracked beside it. Never the plan's headline. */
  secondary: string[];
  /** When the primary signal is read, in days from release. */
  checkpoints: number[];
  /** A sourced number to aim at when the team gives none. Null where there is none. */
  benchmark: Benchmark | null;
}

/** The launch rules of one category: timing, signal and channels, each with its source. */
export interface RuleLibrary {
  category: Category;
  /** `<category>@<date>.<n>`, saved on every plan so a reader knows which rules it used. */
  version: string;
  /** How the calendar is worked back from the release date, in words. */
  timeline: Rule<string>[];
  /** Code-written steps for a category with no kind profiles of its own. */
  beats: Beat[];
  signal: Rule<SignalRule>;
  /** Channels that lead for this category, strongest first. */
  channels: Rule<string[]>;
}
