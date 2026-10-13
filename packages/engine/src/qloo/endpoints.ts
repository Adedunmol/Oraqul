import type { ToolResult } from '../receipts';
import type { QlooClient } from './client';

// TODO(verify): every path and parameter below follows the prototype and
// secondhand notes. Confirm against Qloo's docs and our own key before use.

export interface QlooEntityCandidate {
  id: string;
  name: string;
  type: string;
}

export interface SearchEntityResponse {
  results: QlooEntityCandidate[];
}

export function searchEntity(
  client: QlooClient,
  name: string,
  type: string,
): Promise<ToolResult<SearchEntityResponse>> {
  return client.request<SearchEntityResponse>({
    endpoint: '/search',
    params: { query: name, types: type },
    rule: 'Entity search: candidates matched by name and type',
  });
}
