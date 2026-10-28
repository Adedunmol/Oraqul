import { z } from 'zod';
import { findingSchema } from './finding';
import { confidenceSchema, directionSchema } from './verdict';

// The launch plan: a minimum core plus modules (spec §6.1). The model writes the lines from the
// findings (stage 2) and code checks every line before the plan is saved.

export const launchCoreKeys = [
  'bottom-line',
  'positioning',
  'audience',
  'markets',
  'gaps',
] as const;
export const launchModuleKeys = [
  'partnerships',
  'placement',
  'publicity',
  'community',
  'route',
  'timeline',
  'cadence',
  'budget',
  'measure',
  'risks',
  // Every full plan: channels written by code, and short creative briefs (guides, never assets).
  'channels',
  'creative',
  // The social content calendar: written by code from the release date, like the timeline.
  'calendar',
  // A creative kit's sections.
  'hooks',
  'scripts',
  'shots',
  'keyart',
  'captions',
  // Music only. Each category picks its own modules from this list (`pickModules` in its pack).
  'tour',
  'support',
  'sync',
  // Games only. Which of these a plan gets depends on the launch kind (`pickModules` in the pack).
  'collabs',
  'creators',
  'store',
  'events',
  'softlaunch',
  'liveops',
  'earlyaccess',
  // Podcasts only. Which of these a plan gets depends on the launch kind and the format.
  'crosspromo',
  'guests',
  'live',
  'video',
  // Live shows only. Code writes the first two from the show date and the on-sale rules.
  'onsale',
  'finalpush',
  'venues',
  // Books only. Which of these a plan gets depends on the launch kind, the route and the readership.
  'comps',
  'adaptation',
  'retail',
  'audio',
  'schools',
] as const;
export const launchSectionKeys = [...launchCoreKeys, ...launchModuleKeys] as const;
export const launchSectionKeySchema = z.enum(launchSectionKeys);
export type LaunchSectionKey = z.infer<typeof launchSectionKeySchema>;
export type LaunchModuleKey = (typeof launchModuleKeys)[number];

/**
 * `grounded` lines claim something about taste, audience or place and cite findings.
 * `playbook` lines are launch practice: labelled, citing nothing.
 */
export const lineKindSchema = z.enum(['grounded', 'playbook']);
export type LineKind = z.infer<typeof lineKindSchema>;

/** A fact found on the web (release timing, rival releases, partners), with where it came from. */
export const planSourceSchema = z.object({
  id: z.string().min(1),
  /** The fact, in a sentence. A line may state a date or figure only if a source states it. */
  fact: z.string().min(1),
  title: z.string(),
  url: z.url(),
  /** The day the fact was read from the page. Plans saved before it have none. */
  retrievedAt: z.string().nullable().optional(),
  /** The day an event the fact describes happens, when the page says (ISO date). */
  eventDate: z.string().nullable().optional(),
});
export type PlanSource = z.infer<typeof planSourceSchema>;

export const launchLineSchema = z.object({
  /** Stable for the same section and subject, so a scenario can mark what changed. */
  id: z.string().min(1),
  kind: lineKindSchema,
  text: z.string().min(1),
  /** Empty for playbook lines. */
  findingIds: z.array(z.string()),
  /** The web sources a line's facts come from. Older plans have none. */
  sourceIds: z.array(z.string()).default([]),
  /** Every entity, title or place the line names, so code can check each one. */
  names: z.array(z.string()),
  /** A heading within the section, such as a city or "Key messages". */
  group: z.string().nullable(),
});
export type LaunchLine = z.infer<typeof launchLineSchema>;

export const launchSectionSchema = z.object({
  key: launchSectionKeySchema,
  title: z.string(),
  lines: z.array(launchLineSchema),
});
export type LaunchSection = z.infer<typeof launchSectionSchema>;

/**
 * A comp the plan stands on. `you` is the team's; `added` is a title Oraqul chose from the
 * description; `genre` is a title Qloo lists for the genre when nothing else was found.
 */
export const compUsedSchema = z.object({
  name: z.string(),
  source: z.enum(['you', 'added', 'genre']),
  /** Why Oraqul chose it, for `added` titles. */
  why: z.string().nullable().optional(),
  /** The Qloo match, such as "2018 · Nigeria", when code chose between same-name titles. */
  match: z.string().nullable(),
  /** Why code picked this match from several, said plainly. Null for a single match. */
  choice: z.string().nullable(),
  /**
   * True for a title the launch names beside its comps, such as an earlier show or a featured
   * artist. It anchors the audience question but is never listed or written about as a comp.
   */
  anchor: z.boolean().optional(),
});
export type CompUsed = z.infer<typeof compUsedSchema>;

/** A line code removed in the check, kept so the drop is never silent. */
export const droppedLineSchema = z.object({
  section: launchSectionKeySchema,
  text: z.string(),
  why: z.string(),
});
export type DroppedLine = z.infer<typeof droppedLineSchema>;

/** What the analyst read from a request before any query ran (spec §3.2). */
export const understandingSchema = z.object({
  /** What the person wants back, in a sentence. */
  asked: z.string(),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
  /**
   * Values the analyst filled in because the person did not say them. They steer the queries and
   * show on the plan as assumptions; they are never evidence.
   */
  assumed: z.array(z.object({ what: z.string(), value: z.string(), why: z.string() })),
  /**
   * Who the audience probably is, read from the description before the comps were chosen. It
   * steers which comps are looked up and is never evidence.
   */
  readers: z
    .object({
      who: z.string(),
      ages: z.array(z.string()),
      consumes: z.string(),
      why: z.string(),
    })
    .nullable()
    .optional(),
  /** The comps Oraqul chose from the description, each with why. Never the team's own. */
  proposed: z.array(z.object({ name: z.string(), why: z.string() })).optional(),
  /** What a good answer must do. The research, the writer and the review all work from these. */
  criteria: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** True when answering it needs Qloo audience data. Only those are checked for coverage. */
      evidence: z.boolean().default(true),
      /** How well the research covers it, set by code once the findings are in. */
      status: z.enum(['covered', 'thin', 'missing', 'unchecked']).default('unchecked'),
      /** The findings that bear on it, strongest first. */
      findingIds: z.array(z.string()).default([]),
    }),
  ),
  by: z.enum(['model', 'scripted']),
});
export type Understanding = z.infer<typeof understandingSchema>;

export const reviewIssueTypes = [
  'missing',
  'off-brief',
  'contradicts-context',
  'weak-evidence',
  'unhelpful',
  'vague',
  'dead-end',
  'overclaim',
] as const;

/** One thing the red team found wrong with a draft, against a check or the request as a whole. */
export const reviewIssueSchema = z.object({
  /** A check id, or `general`. */
  check: z.string(),
  type: z.enum(reviewIssueTypes),
  text: z.string(),
  /** What the next draft should do about it. */
  fix: z.string(),
  /** A blocking issue fails the draft. Code decides, from this list alone. */
  blocking: z.boolean(),
  /** A question only the person can answer, when the issue cannot be settled by research or writing. */
  ask: z.string().optional(),
});
export type ReviewIssue = z.infer<typeof reviewIssueSchema>;

/**
 * What the red team made of a plan before it was saved: each round's issues and what was done
 * about them. `unchecked` when no model was available to review.
 */
export const planReviewSchema = z.object({
  status: z.enum(['passed', 'flagged', 'unchecked']),
  rounds: z.array(
    z.object({
      round: z.number().int(),
      issues: z.array(reviewIssueSchema),
      action: z.enum(['approved', 'rewrote', 'researched', 'stopped']),
    }),
  ),
  /** What the person could give or try to make the plan stronger. */
  next: z.array(z.string()),
});
export type PlanReview = z.infer<typeof planReviewSchema>;

/**
 * How the plan was made: what each research round was missing and ran, and the lines the check
 * removed from every draft. Saved so the work is never silent.
 */
export const planProcessSchema = z.object({
  research: z.array(
    z.object({
      round: z.number().int(),
      /** The checks still open when the round began, in the person's terms. */
      open: z.array(z.string()),
      asked: z.array(z.object({ label: z.string(), why: z.string(), found: z.boolean() })),
      retried: z.array(z.object({ label: z.string(), says: z.string(), found: z.boolean() })),
      consulted: z.array(z.object({ category: z.string(), name: z.string(), found: z.boolean() })),
    }),
  ),
  drafts: z.number().int(),
  dropped: z.array(droppedLineSchema.extend({ draft: z.number().int() })),
});
export type PlanProcess = z.infer<typeof planProcessSchema>;

export const budgetBands = ['micro', 'independent', 'mid', 'major'] as const;
export const budgetBandSchema = z.enum(budgetBands);
export type BudgetBand = z.infer<typeof budgetBandSchema>;

/** Who is launching, as the brief says it. Decides which partners are realistic beside the band. */
export const launcherKinds = ['solo', 'small', 'established', 'major'] as const;
export const launcherKindSchema = z.enum(launcherKinds);
export type LauncherKind = z.infer<typeof launcherKindSchema>;

/**
 * The budget band a plan was written for, and how it was learned. `launcher` is set only when the
 * brief says who is launching: a plan never guesses it.
 */
export const planBandSchema = z.object({
  band: budgetBandSchema,
  source: z.enum(['brief', 'asked', 'assumed']),
  launcher: launcherKindSchema.optional(),
});
export type PlanBand = z.infer<typeof planBandSchema>;

/** The one signal the plan is judged on. A target is a goal, never a forecast. */
export const signalSchema = z.object({
  key: z.string(),
  primary: z.string(),
  secondary: z.array(z.string()),
  /** Days from release when the signal is read. Negative is before. */
  checkpoints: z.array(z.number().int()),
  target: z
    .object({
      value: z.number(),
      floor: z.number().nullable(),
      unit: z.string(),
      from: z.enum(['team', 'rule']),
      ruleId: z.string().nullable(),
    })
    .nullable(),
});
export type Signal = z.infer<typeof signalSchema>;

/** A call on a decision, computed by code. A team choice keeps the choice and says how to handle it. */
export const directionCallSchema = z.object({
  id: z.string().min(1),
  subject: z.enum(['date', 'territory', 'partner']),
  name: z.string(),
  direction: directionSchema,
  confidence: confidenceSchema,
  why: z.string(),
  findingIds: z.array(z.string()),
  teamChoice: z.boolean(),
  territory: z.string().nullable(),
});
export type DirectionCall = z.infer<typeof directionCallSchema>;

/** One territory of the plan: home first, then the diaspora cities. */
export const territorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  role: z.enum(['home', 'diaspora', 'other']),
  order: z.number().int().min(0),
  /** The direction call for opening here. Null when Qloo could not rank the place. */
  callId: z.string().nullable(),
  channels: z.array(z.object({ name: z.string(), lead: z.boolean() })),
  partnerIds: z.array(z.string()),
  /** Plan lines that belong to this territory. */
  lineIds: z.array(z.string()),
});
export type Territory = z.infer<typeof territorySchema>;

export const partnerTiers = ['A', 'B', 'C'] as const;
export const partnerTierSchema = z.enum(partnerTiers);
export type PartnerTier = z.infer<typeof partnerTierSchema>;

/** What each tier means, in one place so the rules, the plan screen and the exports say the same. */
export const TIER_LABEL: Record<PartnerTier, { name: string; what: string }> = {
  A: { name: 'Flagship', what: 'Big national brands. Only for releases with scale.' },
  B: {
    name: 'Category and integration',
    what: 'Brands that fit the category, such as banks and payment brands, food and drink, hospitality and telecom bundles.',
  },
  C: {
    name: 'Local',
    what: 'Local businesses, creators, venues and community groups. Most realistic for a solo or independent release.',
  },
};

/** A content fit or fan backlash flag on a partner (T2). */
export const partnerFlagSchema = z.object({
  type: z.enum(['content', 'backlash']),
  why: z.string(),
});
export type PartnerFlag = z.infer<typeof partnerFlagSchema>;

/**
 * What a partner could give. Never assumed cash: an independent release is rarely paid, so a brand
 * defaults to in kind (launch rules T1) and a kind of partner is read from what it is.
 */
export const moneyTypes = ['cash', 'in_kind', 'placement', 'media', 'bulk_tickets'] as const;
export const moneyTypeSchema = z.enum(moneyTypes);
export type MoneyType = z.infer<typeof moneyTypeSchema>;

/** A partner the plan can approach, with its tier, Qloo fit and budget fit. Price is never known. */
/**
 * What an outside source says about a named brand: `verified` (found, with where it is based),
 * `unverified` (not found, or the source was down) or `problem` (no longer exists). A problem is
 * removed before the plan is written, so a saved plan only carries the other two.
 */
export const partnerCheckSchema = z.object({
  state: z.enum(['verified', 'unverified', 'problem']),
  note: z.string().nullable(),
  /** Where the brand is based, when the source says. It becomes the partner's market. */
  country: z.string().nullable().default(null),
  /** Countries a page says the brand sells in, found for the cities it was ranked in. */
  operates: z.array(z.object({ country: z.string(), title: z.string(), url: z.url() })).default([]),
});
export type PartnerCheck = z.infer<typeof partnerCheckSchema>;

export const partnerOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  tier: partnerTierSchema,
  /** Where the brand operates, when a source says. Null for a taste fit nobody has checked. */
  market: z.string().nullable(),
  from: z.enum(['seed', 'qloo', 'team']),
  /** Place in the list Qloo ranked for this audience. Null when Qloo did not rank it. */
  fit: z
    .object({
      place: z.number().int(),
      of: z.number().int(),
      direction: directionSchema,
      /** Its place among the same brands for the city and age band alone, with no comps. Null when not asked. */
      local: z.object({ place: z.number().int(), of: z.number().int() }).nullable().optional(),
    })
    .nullable(),
  budgetFit: z.enum(['fits', 'stretch', 'out']),
  price: z.literal('unknown'),
  findingIds: z.array(z.string()),
  /** A named brand, or a kind of partner with no name yet, such as "bookshops". */
  kind: z.enum(['brand', 'kind']).default('brand'),
  /** Mismatches between the work and this partner, set by code. Direction only: never a drop. */
  flags: z.array(partnerFlagSchema).default([]),
  /** What it could give, set by code. Tiers and their logic do not depend on it. */
  moneyType: moneyTypeSchema.default('in_kind'),
  /** Wikidata's read of a named brand. Absent for kinds of partner and when no check ran. */
  check: partnerCheckSchema.optional(),
});
export type PartnerOption = z.infer<typeof partnerOptionSchema>;

/** A flagship the launch cannot clearly reach is a goal to grow toward, not part of the plan. */
export const isLaterPartner = (p: Pick<PartnerOption, 'tier' | 'budgetFit' | 'from'>): boolean =>
  p.tier === 'A' && p.budgetFit !== 'fits' && p.from !== 'team';

/** What a partner's Qloo fit reads as: a place, a list too short to judge, or not ranked at all. */
export function partnerFitText(p: Pick<PartnerOption, 'fit' | 'findingIds'>): string {
  if (p.fit) return `${p.fit.place} of ${p.fit.of}`;
  return p.findingIds.length > 0 ? 'listed, too few brands to judge' : 'not ranked';
}

/** A note on lead time, band or barter, written by code from the partner rules (T1). */
export const partnerNoteSchema = z.object({
  id: z.string().min(1),
  /** The rule behind it, such as `partners.lead-time`. */
  ruleId: z.string(),
  text: z.string().min(1),
});
export type PartnerNote = z.infer<typeof partnerNoteSchema>;

/** One row of the content calendar, for one territory on its lead channel. Written by code. */
export const calendarRowSchema = z.object({
  id: z.string().min(1),
  /** The territory the row is for. Null when the plan has none. */
  territory: z.string().nullable(),
  key: z.string(),
  /** Weeks from the release. Negative is before it. */
  at: z.number().int(),
  until: z.number().int().optional(),
  /** `YYYY-MM-DD`, or null when the release date is not known. */
  from: z.string().nullable(),
  to: z.string().nullable(),
  /** The kind of asset to post. Null where the rule names none. */
  asset: z.string().nullable(),
  post: z.string(),
  channel: z.string(),
  /** Posts, as the source states it. Null where there is no number. */
  count: z.number().int().nullable(),
  per: z.enum(['week', 'day', 'span']).nullable(),
  /** The rule behind the row, and how far to lean on it. */
  ruleId: z.string(),
  grade: z.enum(['team', 'directional', 'not-researched']),
});
export type CalendarRow = z.infer<typeof calendarRowSchema>;

/**
 * Something the team did not choose that the evidence points to: a nearby market, or an area of a
 * city it did choose. It sits beside the plan and is never a commitment until the team adopts it.
 * The four lines are ordinary lines of the markets section, in the group "Worth a look".
 */
export const opportunitySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['market', 'area']),
  name: z.string(),
  /** The team city an area sits in. Null for a market. */
  city: z.string().nullable(),
  /** The findings behind the `why` line. Always at least one: no finding, no opportunity. */
  findingIds: z.array(z.string()).min(1),
  /** Line ids: why it fits (grounded), then its limit, first test and measure (playbook). */
  lines: z.object({ why: z.string(), limit: z.string(), test: z.string(), measure: z.string() }),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const launchPlanSchema = z.object({
  /** `full` for a launch plan or an unclear ask, `narrow` for one question. */
  scope: z.enum(['full', 'narrow']),
  sections: z.array(launchSectionSchema),
  comps: z.array(compUsedSchema),
  /** Comps the team named that Qloo had nothing close to, and so the plan leaves out. */
  compsNotFound: z.array(z.object({ name: z.string(), why: z.string() })).default([]),
  findings: z.array(findingSchema),
  /** What was found on the web for this plan. Older plans have none. */
  sources: z.array(planSourceSchema).default([]),
  dropped: z.array(droppedLineSchema),
  /** `model` when a model wrote the lines, `template` when code did (no key, or a failed call). */
  writer: z.enum(['model', 'template']),
  /** How the request was read. Plans saved before the analyst have none. */
  understanding: understandingSchema.nullable().default(null),
  /** The red team's verdict on the saved draft. Plans saved before it have none. */
  review: planReviewSchema.nullable().default(null),
  /** What the research and the line check did on the way. Plans saved before it have none. */
  process: planProcessSchema.nullable().default(null),
  /** The rule library version the plan was written with. Plans saved before it have none. */
  rules: z
    .object({
      category: z.string(),
      version: z.string(),
      /** The shared libraries the plan also used, by version. Older plans have none. */
      parts: z.record(z.string(), z.string()).default({}),
    })
    .nullable()
    .default(null),
  band: planBandSchema.nullable().default(null),
  signal: signalSchema.nullable().default(null),
  territories: z.array(territorySchema).default([]),
  calls: z.array(directionCallSchema).default([]),
  partners: z.array(partnerOptionSchema).default([]),
  partnerNotes: z.array(partnerNoteSchema).default([]),
  /** The content calendar rows, for the table on the plan page. Plans saved before it have none. */
  calendar: z.array(calendarRowSchema).default([]),
  /** What the evidence points to beyond the brief. Plans saved before it have none. */
  opportunities: z.array(opportunitySchema).default([]),
});
export type LaunchPlan = z.infer<typeof launchPlanSchema>;
