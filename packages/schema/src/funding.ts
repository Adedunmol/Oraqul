import { z } from 'zod';
import { moneyTypeSchema } from './plan';

// Funding and sponsors (spec §5.20). Sponsors are the plan's own Qloo ranked brands, each with the
// recent entertainment sponsorship found on a page. Funds come from the web at run time: nothing is
// seeded, and every field is the page's own or unknown. Eligibility is computed in code. A fund is
// not a partner and has no tier, and a price, a fee or the terms of a loan are never quoted.

export const fundingKinds = ['sponsor', 'fund'] as const;
export const fundingKindSchema = z.enum(fundingKinds);

export const fundingStatuses = [
  'found',
  'qualified',
  'drafted',
  'approved',
  'sent_by_you',
  'replied',
  'won',
  'lost',
] as const;
export const fundingStatusSchema = z.enum(fundingStatuses);
export type FundingStatus = z.infer<typeof fundingStatusSchema>;

export const projectStages = ['idea', 'development', 'production', 'post', 'released'] as const;
export const projectStageSchema = z.enum(projectStages);
export type ProjectStage = z.infer<typeof projectStageSchema>;

/** What eligibility is compared with beyond the plan: where the work is and who is making it. */
export const projectFactsSchema = z.object({
  stage: projectStageSchema.nullable().default(null),
  nationality: z.string().trim().min(1).max(60).nullable().default(null),
});
export type ProjectFacts = z.infer<typeof projectFactsSchema>;

export const fundTypes = ['grant', 'fund', 'loan', 'programme', 'other'] as const;
export const fundTypeSchema = z.enum(fundTypes);

export const criterionFields = ['category', 'stage', 'nationality', 'territory', 'other'] as const;

/** A published condition, as the page states it. `value` is what it is compared with, when it names one. */
export const fundCriterionSchema = z.object({
  text: z.string(),
  field: z.enum(criterionFields),
  value: z.string().nullable(),
});
export type FundCriterion = z.infer<typeof fundCriterionSchema>;

export const eligibilityVerdicts = ['eligible', 'check', 'not-eligible'] as const;
export const eligibilitySchema = z.object({
  verdict: z.enum(eligibilityVerdicts),
  /** Published criteria that appear met by what the plan and the project say. */
  met: z.array(z.string()),
  /** Criteria nothing known can be compared with. Any one of these makes the verdict `check`. */
  unknown: z.array(z.string()),
  failed: z.array(z.string()),
});
export type Eligibility = z.infer<typeof eligibilitySchema>;

export const fundDataSchema = z.object({
  owner: z.string().nullable(),
  type: fundTypeSchema,
  /** The amount as the page writes it, or null when the page gives none. Never computed. */
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  /** `YYYY-MM-DD`, or null when the page gives none. */
  deadline: z.string().nullable(),
  criteria: z.array(fundCriterionSchema),
  applicationUrl: z.string().nullable(),
  sourceUrl: z.string(),
  sourceTitle: z.string(),
  /** The day the page was read. */
  retrievedAt: z.string(),
  eligibility: eligibilitySchema,
});
export type FundData = z.infer<typeof fundDataSchema>;

export const sponsorDataSchema = z.object({
  moneyType: moneyTypeSchema,
  /** Where Qloo ranks the brand for this audience: place of how many. */
  fit: z.object({ place: z.number().int(), of: z.number().int() }).nullable(),
  findingIds: z.array(z.string()),
  /** A recent entertainment sponsorship the page states, with the words and the day it was read. */
  evidence: z
    .object({
      url: z.string(),
      title: z.string(),
      retrievedAt: z.string(),
      quote: z.string(),
    })
    .nullable(),
});
export type SponsorData = z.infer<typeof sponsorDataSchema>;

export const fundingItemSchema = z.object({
  id: z.uuid(),
  planId: z.uuid(),
  kind: fundingKindSchema,
  name: z.string(),
  territory: z.string().nullable(),
  status: fundingStatusSchema,
  /** `YYYY-MM-DD` */
  nextFollowUpOn: z.string().nullable(),
  note: z.string(),
  sponsor: sponsorDataSchema.nullable(),
  fund: fundDataSchema.nullable(),
  updatedAt: z.string(),
});
export type FundingItem = z.infer<typeof fundingItemSchema>;

export const fundingStateSchema = z.object({
  planId: z.uuid(),
  /** `none` when the plan cannot have funding looked up, `ready` before the first run, `set` after. */
  status: z.enum(['none', 'ready', 'set']),
  reason: z.string().nullable(),
  facts: projectFactsSchema,
  items: z.array(fundingItemSchema),
  /** Whether web search is set up. Without it nothing is looked up and the page says so. */
  canSearch: z.boolean(),
});
export type FundingState = z.infer<typeof fundingStateSchema>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A status here is one a person may set. Approved and sent by you have their own steps. */
export const updateFundingItemSchema = z.object({
  status: z.enum(['found', 'qualified', 'replied', 'won', 'lost']).optional(),
  nextFollowUpOn: day.nullable().optional(),
  note: z.string().max(2000).optional(),
});
export type UpdateFundingItem = z.infer<typeof updateFundingItemSchema>;

export const setFactsSchema = projectFactsSchema;

/** The checked text a person opens in their own app. Nothing here is sent by Oraqul. */
export const draftSchema = z.object({
  subject: z.string(),
  text: z.string(),
  /** The structured pack: logline, audience evidence, budget band, territories. */
  parts: z.object({
    logline: z.string(),
    audience: z.array(z.string()),
    budgetBand: z.string().nullable(),
    territories: z.array(z.string()),
    ask: z.string(),
  }),
});
export type Draft = z.infer<typeof draftSchema>;

/** What approving a draft returns: the item as it now is, and the checked text to open in an app. */
export const draftResultSchema = z.object({ item: fundingItemSchema, draft: draftSchema });
export type DraftResult = z.infer<typeof draftResultSchema>;
