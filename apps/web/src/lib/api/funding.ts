import {
  type DraftResult,
  draftResultSchema,
  type FundingItem,
  type FundingState,
  fundingItemSchema,
  fundingStateSchema,
  type ProjectFacts,
  projectFactsSchema,
  type UpdateFundingItem,
} from '@oraqul/schema';
import { clientRequest } from './client';

export function setProjectFacts(projectId: string, facts: ProjectFacts): Promise<ProjectFacts> {
  return clientRequest(
    `/projects/${projectId}/facts`,
    { method: 'PUT', body: facts },
    projectFactsSchema,
  );
}

export function updateFundingItem(
  outputId: string,
  itemId: string,
  patch: UpdateFundingItem,
): Promise<FundingItem> {
  return clientRequest(
    `/outputs/${outputId}/funding/items/${itemId}`,
    { method: 'PATCH', body: patch },
    fundingItemSchema,
  );
}

/** Writes the pitch or application from the plan. Nothing is sent. */
export function draftFundingItem(outputId: string, itemId: string): Promise<DraftResult> {
  return clientRequest(
    `/outputs/${outputId}/funding/items/${itemId}/draft`,
    { method: 'POST' },
    draftResultSchema,
  );
}

/** Approves the draft and returns its text, for the person to open in their own app. */
export function approveFundingItem(outputId: string, itemId: string): Promise<DraftResult> {
  return clientRequest(
    `/outputs/${outputId}/funding/items/${itemId}/handoff`,
    { method: 'POST' },
    draftResultSchema,
  );
}

/** The person says they sent it. The only way an item reaches "sent by you". */
export function confirmFundingSent(outputId: string, itemId: string): Promise<FundingItem> {
  return clientRequest(
    `/outputs/${outputId}/funding/items/${itemId}/sent`,
    { method: 'POST' },
    fundingItemSchema,
  );
}
