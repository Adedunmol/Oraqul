import {
  type ExtractedRules,
  type ExtractRulesInput,
  extractedRulesSchema,
  type TeamRule,
  type TeamRulesResponse,
  teamRulesResponseSchema,
} from '@oraqul/schema';
import { clientRequest } from './client';

/** Reads pasted text into proposed rules. Nothing is active until an owner confirms it. */
export function extractRules(teamId: string, body: ExtractRulesInput): Promise<ExtractedRules> {
  return clientRequest(
    `/teams/${teamId}/rules/extract`,
    { method: 'POST', body },
    extractedRulesSchema,
  );
}

export async function confirmRule(teamId: string, ruleId: string): Promise<TeamRule[]> {
  const { rules } = await clientRequest(
    `/teams/${teamId}/rules/${ruleId}/confirm`,
    { method: 'POST' },
    teamRulesResponseSchema,
  );
  return rules;
}

export async function rejectRule(
  teamId: string,
  ruleId: string,
  reason: string,
): Promise<TeamRule[]> {
  const { rules } = await clientRequest(
    `/teams/${teamId}/rules/${ruleId}/reject`,
    { method: 'POST', body: { reason } },
    teamRulesResponseSchema,
  );
  return rules;
}

export async function archiveRule(teamId: string, ruleId: string): Promise<TeamRule[]> {
  const { rules } = await clientRequest(
    `/teams/${teamId}/rules/${ruleId}/archive`,
    { method: 'POST' },
    teamRulesResponseSchema,
  );
  return rules;
}
