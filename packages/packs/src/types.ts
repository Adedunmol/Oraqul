import type { Category } from '@oraqul/schema';

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
  toolAllowlist: string[];
  coverage: { tests: string[]; thin: string[]; notSupported: string[] };
}
