import type { Category, PlanSectionKey, QlooCoverage, ToolName } from '@oraqul/schema';

/**
 * One category agent is a configuration of the shared runtime.
 * Fields follow the table in docs/product/spec.md section 3.2.
 */
export interface CategoryPack {
  category: Category;
  title: string;
  /** One line on what the category plans. Also shown on the router's category card. */
  blurb: string;
  /** What counts as this category, for the router: the kinds of work a person might name. */
  covers: string;
  systemPrompt: string;
  assumptionChecklist: string[];
  /** The plan's four sections, as the output's Plan tab shows them. `one` names a single line. */
  planSections: { key: PlanSectionKey; title: string; one: string }[];
  toolAllowlist: ToolName[];
  /** Other categories this agent may ask one bounded question (spec §3.4). Only Books lists Film. */
  consults: Category[];
  /** Qloo entity types this category tests, by role. */
  qloo: QlooCoverage;
  coverage: { tests: string[]; thin: string[]; notSupported: string[] };
}
