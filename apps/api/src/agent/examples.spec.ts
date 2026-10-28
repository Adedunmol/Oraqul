import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { outputDetailSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { qaCheck } from './qa/qa-check.js';

// The marketing examples are real runs on live Qloo data, recorded by the live runner with
// RECORD_EXAMPLES=1 (docs/testing.md) and redacted as a share link is. This spec does not make
// them; it keeps what is committed fit to show: it parses, it is not demo data, it carries no Qloo
// responses, and the QA checker finds nothing wrong with it.

const dir = fileURLToPath(new URL('../../../web/src/lib/examples/', import.meta.url));
const read = (name: string): unknown => JSON.parse(readFileSync(`${dir}${name}.json`, 'utf8'));
const briefs = read('briefs') as Record<string, string>;

describe('the marketing examples', () => {
  it.each(['film', 'music', 'books', 'podcasts'] as const)(
    '%s is a clean, redacted live run',
    (id) => {
      const { output } = outputDetailSchema.parse(read(id));

      expect(output.receipts.length).toBeGreaterThan(0);
      for (const receipt of output.receipts) {
        expect(receipt.source).not.toBe('demo');
        expect(receipt.input).toEqual({});
        expect(receipt.returned).toBeNull();
      }

      const { plan } = output;
      if (!plan) throw new Error('Expected a launch plan');
      const found = qaCheck({
        plan,
        cannot: output.brief.cannot,
        briefText: [briefs[id] ?? '', output.title].join('\n'),
        today: output.createdAt.slice(0, 10),
      });
      expect(found).toEqual([]);
    },
  );
});
