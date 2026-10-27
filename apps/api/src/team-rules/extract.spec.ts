import { describe, expect, it } from 'vitest';
import { parseBudget, ScriptedRuleExtractor } from './extract.js';

const read = (text: string) => new ScriptedRuleExtractor().extract(text);

describe('parseBudget', () => {
  it.each([
    ['£50k', { amount: 50_000, currency: 'GBP' }],
    ['$1.5m', { amount: 1_500_000, currency: 'USD' }],
    ['NGN 20,000,000', { amount: 20_000_000, currency: 'NGN' }],
    ['250,000 EUR', { amount: 250_000, currency: 'EUR' }],
  ])('reads %s', (text, out) => expect(parseBudget(text)).toEqual(out));
  it('needs a currency', () => expect(parseBudget('50000')).toBeNull());
});

describe('ScriptedRuleExtractor', () => {
  it('reads the template lines', async () => {
    const out = await read(
      [
        'Markets: Lagos, London and Houston',
        'Budget ceiling: £50k',
        'Banned partners: Guinness, MTN',
        'Channels never used: Facebook; X',
        'Tone: warm, plain, no hype',
        'Language: British English',
        'Brand safety: no alcohol or gambling',
        'Banned topics: politics',
        'Who must approve: owner',
      ].join('\n'),
    );
    expect(out.unparsed).toEqual([]);
    expect(out.candidates.map((c) => c.value)).toEqual([
      { kind: 'territory_allow', names: ['Lagos', 'London', 'Houston'] },
      { kind: 'budget_max', amount: 50_000, currency: 'GBP' },
      { kind: 'partner_block', names: ['Guinness', 'MTN'] },
      { kind: 'channel_block', names: ['Facebook', 'X'] },
      { kind: 'tone', text: 'warm, plain, no hype' },
      { kind: 'language', text: 'British English' },
      { kind: 'brand_safety', text: 'no alcohol or gambling' },
      { kind: 'topic_block', text: 'politics' },
      { kind: 'approval', role: 'owner' },
    ]);
    expect(out.candidates.every((c) => c.rejection === null)).toBe(true);
  });

  it('accepts a content rule against homophobic suggestions and rejects the rest with a reason', async () => {
    const out = await read(
      [
        'We don’t welcome homophobic suggestions',
        'Never say unknown',
        'Only market to men',
        'Send the brief to partners automatically',
      ].join('\n'),
    );
    expect(out.candidates.map((c) => [c.sourceText, c.rejection])).toEqual([
      ['We don’t welcome homophobic suggestions', null],
      ['Never say unknown', 'honesty'],
      ['Only market to men', 'discrimination'],
      ['Send the brief to partners automatically', 'operational'],
    ]);
    expect(out.candidates[0]?.value.kind).toBe('topic_block');
  });

  it('leaves a line it cannot read, and a budget with no currency, as unparsed', async () => {
    const out = await read('We love Lagos\nBudget ceiling: 50000');
    expect(out.candidates).toEqual([]);
    expect(out.unparsed).toEqual(['We love Lagos', 'Budget ceiling: 50000']);
  });
});
