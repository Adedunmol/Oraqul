import {
  type ExtractedRules,
  type ExtractRulesInput,
  extractedRulesSchema,
  type TeamRule,
  type TeamRulesResponse,
  teamRulesResponseSchema,
} from '@oraqul/schema';
import { clientRequest } from './client';

/** Reads pasted text and saves its rules, live at once. */
export function extractRules(teamId: string, body: ExtractRulesInput): Promise<ExtractedRules> {
  return clientRequest(
    `/teams/${teamId}/rules/extract`,
    { method: 'POST', body },
    extractedRulesSchema,
  );
}

export async function archiveRule(teamId: string, ruleId: string): Promise<TeamRule[]> {
  const { rules } = await clientRequest(
    `/teams/${teamId}/rules/${ruleId}/archive`,
    { method: 'POST' },
    teamRulesResponseSchema,
  );
  return rules;
}
