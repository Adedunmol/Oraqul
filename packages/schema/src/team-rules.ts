import { z } from 'zod';
import { roleSchema } from './categories';

// Team defaults (spec §5.21): rules an owner or editor saved that every run of the team follows.
// Each is a plain sentence with the words it came from. Hard rules are enforced in code, never only
// in a prompt, and no rule can change a refusal, a verdict or a number.

export const teamRuleKinds = [
  'budget_max',
  'territory_allow',
  'territory_block',
  'partner_block',
  'channel_block',
  'approval',
  'tone',
  'language',
  'brand_safety',
  'topic_block',
] as const;
export const teamRuleKindSchema = z.enum(teamRuleKinds);
export type TeamRuleKind = z.infer<typeof teamRuleKindSchema>;

export const ruleScopes = ['team', 'project'] as const;
export const ruleStatuses = ['proposed', 'active', 'rejected', 'archived'] as const;
export const ruleEnforcements = ['code', 'prompt'] as const;
export const ruleEnforcementSchema = z.enum(ruleEnforcements);
export type RuleEnforcement = z.infer<typeof ruleEnforcementSchema>;

const names = z.array(z.string().min(1).max(80)).min(1).max(40);

/** The value of each kind of rule. A prompt rule holds words; a code rule holds what code compares. */
export const teamRuleValueSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('budget_max'),
    amount: z.number().positive(),
    currency: z.string().min(1).max(8),
  }),
  z.object({ kind: z.literal('territory_allow'), names }),
  z.object({ kind: z.literal('territory_block'), names }),
  z.object({ kind: z.literal('partner_block'), names }),
  z.object({ kind: z.literal('channel_block'), names }),
  /** The lowest role that may approve anything leaving Oraqul. */
  z.object({ kind: z.literal('approval'), role: roleSchema.exclude(['viewer']) }),
  z.object({ kind: z.literal('tone'), text: z.string().min(1).max(300) }),
  z.object({ kind: z.literal('language'), text: z.string().min(1).max(120) }),
  z.object({ kind: z.literal('brand_safety'), text: z.string().min(1).max(300) }),
  z.object({ kind: z.literal('topic_block'), text: z.string().min(1).max(300) }),
]);
export type TeamRuleValue = z.infer<typeof teamRuleValueSchema>;

/** Which of these code enforces. The rest go into the writer's prompt and the red team's check. */
export const RULE_ENFORCEMENT: Record<TeamRuleKind, RuleEnforcement> = {
  budget_max: 'code',
  territory_allow: 'code',
  territory_block: 'code',
  partner_block: 'code',
  channel_block: 'code',
  approval: 'code',
  tone: 'prompt',
  language: 'prompt',
  brand_safety: 'prompt',
  topic_block: 'prompt',
};

/** The field and operator a rule stores, so the table reads without knowing each kind. */
export const RULE_FIELD: Record<TeamRuleKind, { field: string; operator: string }> = {
  budget_max: { field: 'budget', operator: 'max' },
  territory_allow: { field: 'territory', operator: 'in' },
  territory_block: { field: 'territory', operator: 'not_in' },
  partner_block: { field: 'partner', operator: 'not_in' },
  channel_block: { field: 'channel', operator: 'not_in' },
  approval: { field: 'approval', operator: 'min_role' },
  tone: { field: 'tone', operator: 'is' },
  language: { field: 'language', operator: 'is' },
  brand_safety: { field: 'brand_safety', operator: 'is' },
  topic_block: { field: 'topic', operator: 'not_about' },
};

const list = (xs: string[]) =>
  xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** The rule as one plain sentence, as the confirmation screen shows it. */
export function ruleSentence(value: TeamRuleValue): string {
  switch (value.kind) {
    case 'budget_max':
      return `No plan proposes spending more than ${value.currency} ${value.amount.toLocaleString('en-US')}.`;
    case 'territory_allow':
      return `Plans cover only ${list(value.names)}.`;
    case 'territory_block':
      return `Plans never cover ${list(value.names)}.`;
    case 'partner_block':
      return `Never propose ${list(value.names)} as a partner.`;
    case 'channel_block':
      return `Never plan on ${list(value.names)}.`;
    case 'approval':
      return `Anything that leaves Oraqul needs ${value.role === 'owner' ? 'an owner' : 'an owner or editor'} to approve it.`;
    case 'tone':
      return `Write in this tone: ${value.text}`;
    case 'language':
      return `Write in this language: ${value.text}`;
    case 'brand_safety':
      return `Brand safety: ${value.text}`;
    case 'topic_block':
      return `Keep plans away from this: ${value.text}`;
  }
}

export const teamRuleSchema = z.object({
  id: z.uuid(),
  teamId: z.uuid(),
  scope: z.enum(ruleScopes),
  projectId: z.uuid().nullable(),
  kind: teamRuleKindSchema,
  field: z.string(),
  operator: z.string(),
  value: teamRuleValueSchema,
  enforcement: ruleEnforcementSchema,
  /** The words the rule came from, checked to be in what was pasted. */
  sourceText: z.string(),
  status: z.enum(ruleStatuses),
  rejectionReason: z.string().nullable(),
  createdBy: z.uuid().nullable(),
  createdByName: z.string().nullable(),
  confirmedBy: z.uuid().nullable(),
  confirmedAt: z.string().nullable(),
  version: z.number().int(),
  supersedesId: z.uuid().nullable(),
  createdAt: z.string(),
  /** The rule as one plain sentence. */
  sentence: z.string(),
  /** What it clashes with: another active rule, or a project the team already has. */
  conflicts: z.array(z.string()),
});
export type TeamRule = z.infer<typeof teamRuleSchema>;

export const teamRulesResponseSchema = z.object({ rules: z.array(teamRuleSchema) });
export type TeamRulesResponse = z.infer<typeof teamRulesResponseSchema>;

export const extractRulesSchema = z.object({
  text: z.string().min(1).max(8000),
  scope: z.enum(ruleScopes).default('team'),
  projectId: z.uuid().nullable().default(null),
});
export type ExtractRulesInput = z.input<typeof extractRulesSchema>;

/** A rule a run followed, saved on the plan so a reader knows which version it ran under. */
export const appliedRuleSchema = z.object({ id: z.uuid(), version: z.number().int() });
export type AppliedRule = z.infer<typeof appliedRuleSchema>;

/** What pasting text gives back: the rules it was read into, and the lines nothing could be made of. */
export const extractedRulesSchema = z.object({
  rules: z.array(teamRuleSchema),
  unparsed: z.array(z.string()),
});
export type ExtractedRules = z.infer<typeof extractedRulesSchema>;
