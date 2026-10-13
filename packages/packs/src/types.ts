import type { Category, QlooCoverage, ToolName } from '@oraqul/schema';

/**
 * One category agent is a configuration of the shared runtime.
 * Fields follow the table in docs/product/spec.md section 3.2.
 */
export interface CategoryPack {
  category: Category;
  title: string;
  systemPrompt: string;
  assumptionChecklist: string[];
  planSections: { key: string; title: string }[];
  toolAllowlist: ToolName[];
  /** Other categories this agent may ask one bounded question (spec §3.4). Only Books lists Film. */
  consults: Category[];
  /** Qloo entity types this category tests, by role. */
  qloo: QlooCoverage;
  coverage: { tests: string[]; thin: string[]; notSupported: string[] };
}
