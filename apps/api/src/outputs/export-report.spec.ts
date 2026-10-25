import type { Output } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { toMarkdown } from './export.js';

const line = (id: string, text: string, kind: 'grounded' | 'playbook', findingIds: string[]) => ({
  id,
  kind,
  text,
  findingIds,
  sourceIds: [],
  names: [],
  group: 'Worth a look',
});

describe('an audit report export', () => {
  it('carries the Worth a look options with their limit, first test and measure', () => {
    const output = {
      kind: 'audit',
      title: 'Night Ferry audit',
      headline: 'Two assumptions hold.',
      moves: [],
      createdBy: 'Ada',
      createdAt: '2026-10-01T10:00:00.000Z',
      summary: '',
      plan: null,
      receipts: [],
      report: {
        phase: 'pre',
        items: [],
        risks: [],
        alternatives: [
          line('opp-market-accra-why', 'Accra ranks above London for this audience.', 'grounded', [
            'f-worth-a-look',
          ]),
          line('opp-market-accra-test', 'Run one small test in Accra.', 'playbook', []),
        ],
        opportunities: [],
        results: null,
        findings: [
          {
            id: 'f-worth-a-look',
            text: 'Accra has a stronger audience than London.',
          },
        ],
        sources: [],
      },
    } as unknown as Output;
    const md = toMarkdown(output);
    expect(md).toContain('## Worth a look');
    expect(md).toContain('Accra ranks above London for this audience.[^1]');
    expect(md).toContain('Run one small test in Accra.');
  });
});
